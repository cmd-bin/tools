require 'fastlane/action'
require 'fastlane_core'
require 'xcodeproj'
require_relative '../utils/config_helper'
require_relative '../utils/file_helper'


module Fastlane
  module Actions
    class SetupAction < Action
      @@setup_ios_result = nil
      @@setup_android_result = nil

      def self.run(params)
        platform = lane_context[SharedValues::PLATFORM_NAME]

        case platform
        when :ios
          @@setup_ios_result ||= setup_ios(params)
        when :android
          @@setup_android_result ||= setup_android(params)
        else
          UI.user_error!("Unsupported platform for setup: #{platform}")
        end
      end

      def self.setup_ios(params)
        is_ci = other_action.is_ci
        config = ConfigHelper.platform_config(platform: :ios, export_method: params[:export_method], is_ci: is_ci)

        other_action.setup_ci if ENV['CI']
        other_action.clear_derived_data if ENV["CI"]

        match_type = config[:match_type]

        target_identifier_map = other_action.ipc_wrapper(
          event_name: "Loading Targets",
          end_event_name: "Targets loaded",
          action: proc do
            Xcodeproj::Project.open(config[:project]).native_targets.map do |target|
              bundle_id = target.build_configurations.first.build_settings["PRODUCT_BUNDLE_IDENTIFIER"]
              { name: target.name, bundle_id: bundle_id }
            end
          end
        )

        api_key = other_action.ipc_wrapper(
          event_name: "Connecting to Apple Developer account",
          end_event_name: "Connected to Apple Developer account",
          action: proc do
            other_action.app_store_connect_api_key(
              key_id: config[:key_id],
              issuer_id: config[:issuer_id],
              is_key_content_base64: false,
              key_filepath: config[:key_filepath],
              in_house: config[:in_house],
              set_spaceship_token: true
            )
          end
        )

        if params[:run_match]
          other_action.ipc_wrapper(
            event_name: "Matching certificates",
            end_event_name: "Certificates Matched",
            action: proc do
              other_action.match(
                type: match_type,
                app_identifier: target_identifier_map.map { |t| t[:bundle_id] },
                username: config[:match_username],
                clone_branch_directly: true,
                storage_mode: "git",
                git_url: config[:match_git_url],
                git_branch: config[:match_git_branch],
                api_key: api_key,
                readonly: config[:match_readonly],
                git_private_key: FileHelper.decode_base64(config[:match_git_private_key_base64])
              )
            end
          )
        end
        cert_name = params[:run_match] ? ENV["sigh_#{config[:app_identifier]}_#{match_type}_certificate-name"] : nil
        targets = target_identifier_map.map do |target|
          bid = target[:bundle_id]
          {
            name: target[:name],
            bundle_id: bid,
            profile_uuid: params[:run_match] ? ENV["sigh_#{bid}_#{match_type}"] : nil,
            profile_name: params[:run_match] ? ENV["sigh_#{bid}_#{match_type}_profile-name"] : nil,
            profile_path: params[:run_match] ? ENV["sigh_#{bid}_#{match_type}_profile-path"] : nil,
            cert_name: cert_name
          }
        end

        {
          config: config,
          api_key: api_key,
          targets: targets,
          cert_name: cert_name
        }
      end

      def self.setup_android(params)
        is_ci = other_action.is_ci
        config = other_action.ipc_wrapper(
          event_name: "Environment loading",
          end_event_name: "Setup Completed",
          action: proc do
            ConfigHelper.platform_config(platform: :android, export_method: params[:export_method], is_ci: is_ci)
          end
        )

        {
          config: config
        }
      end

      def self.description
        "Setup for iOS and Android"
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :export_method,
                                       description: "Export method",
                                       optional: true,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :run_match,
                                       description: "Run match",
                                       optional: true,
                                       is_string: false,
                                       type: Boolean)
        ]
      end

      def self.is_supported?(platform)
        [:ios, :android].include?(platform)
      end
    end
  end
end
