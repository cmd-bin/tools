# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'
require 'xcodeproj'
require 'json'
require_relative '../utils/index'

module Fastlane
  module Actions
    class SetupAction < Action
      @setup_ios_result = nil
      @setup_android_result = nil

      def self.run(params)
        platform = lane_context[SharedValues::PLATFORM_NAME]

        case platform
        when :ios
          @setup_ios_result ||= setup_ios(params)
        when :android
          @setup_android_result ||= setup_android(params)
        else
          UI.user_error!("Unsupported platform for setup: #{platform}")
        end
      end

      def self.check_node_modules(workspace_path)
        return unless workspace_path && File.directory?(workspace_path)

        Dir.chdir(workspace_path) do
          other_action.ipc_client(event_name: 'Checking node modules')
          if system('npm ls > /dev/null 2>&1')
            other_action.ipc_client(event_name: 'Node modules are up to date')
          else
            other_action.ipc_client(event_name: 'Installing node modules')
            other_action.sh('npm ci')
            other_action.ipc_client(event_name: 'Node modules installed')
          end
        end
      end

      def self.check_pods(ios_path)
        return unless ios_path && File.directory?(ios_path)

        Dir.chdir(ios_path) do
          other_action.ipc_client(event_name: 'Checking pods')
          if system('cmp -s Podfile.lock Pods/Manifest.lock 2>/dev/null')
            other_action.ipc_client(event_name: 'Pods are up to date')
          else
            other_action.ipc_client(event_name: 'Installing pods')
            other_action.sh('bundle exec pod install')
            other_action.ipc_client(event_name: 'Pods installed')
          end
        end
      end

      def self.setup_ios(params)
        is_ci = other_action.is_ci
        run_match = params[:run_match]
        config = ConfigHelper.platform_config(platform: :ios, export_method: params[:export_method], is_ci: is_ci)

        pre_script = ConfigHelper.optional_env('BEFORE_ALL', default: nil)
        other_action.sh(pre_script) if pre_script

        caller_ws = ENV.fetch('CALLER_WORKSPACE', nil)
        if caller_ws && params[:check_dependencies] != false
          check_node_modules(caller_ws)
          check_pods(File.join(caller_ws, 'ios')) unless params[:skip_pods]
        end

        other_action.setup_ci if ENV['CI']
        other_action.clear_derived_data if ENV['CI']

        match_type = config[:match_type]

        target_identifier_map = if params[:need_target_list] || run_match
                                  if ENV['IOS_TARGET_IDENTIFIER_MAP'] && !ENV['IOS_TARGET_IDENTIFIER_MAP'].empty?
                                    begin
                                      JSON.parse(ENV['IOS_TARGET_IDENTIFIER_MAP'], symbolize_names: true)
                                    rescue StandardError
                                      []
                                    end
                                  else
                                    other_action.ipc_wrapper(
                                      event_name: 'Loading Targets',
                                      end_event_name: 'Targets loaded',
                                      action: proc do
                                        Xcodeproj::Project.open(config[:project]).native_targets.map do |target|
                                          settings = target.build_configurations.first.build_settings
                                          bundle_id = settings['PRODUCT_BUNDLE_IDENTIFIER']
                                          { name: target.name, bundle_id: bundle_id }
                                        end
                                      end
                                    )
                                  end
                                else
                                  []
                                end

        if params[:need_api_key]
          api_key = other_action.ipc_wrapper(
            event_name: 'Connecting to Apple Developer account',
            end_event_name: 'Connected to Apple Developer account',
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
        end

        if run_match
          other_action.ipc_wrapper(
            event_name: 'Matching certificates',
            end_event_name: 'Certificates Matched',
            action: proc do
              other_action.match(
                type: match_type,
                app_identifier: target_identifier_map.map { |t| t[:bundle_id] },
                username: config[:match_username],
                clone_branch_directly: true,
                storage_mode: 'git',
                git_url: config[:match_git_url],
                git_branch: config[:match_git_branch],
                api_key: api_key,
                readonly: config[:match_readonly],
                git_private_key: FileHelper.decode_base64(config[:match_git_private_key_base64])
              )
            end
          )
        end
        cert_name = run_match ? ENV.fetch("sigh_#{config[:app_identifier]}_#{match_type}_certificate-name", nil) : nil
        targets = target_identifier_map.map do |target|
          bid = target[:bundle_id]
          {
            name: target[:name],
            bundle_id: bid,
            profile_uuid: run_match ? ENV.fetch("sigh_#{bid}_#{match_type}", nil) : nil,
            profile_name: run_match ? ENV.fetch("sigh_#{bid}_#{match_type}_profile-name", nil) : nil,
            profile_path: run_match ? ENV.fetch("sigh_#{bid}_#{match_type}_profile-path", nil) : nil,
            cert_name: cert_name
          }
        end

        {
          **config,
          config: config,
          api_key: api_key,
          targets: targets,
          cert_name: cert_name
        }
      end

      def self.setup_android(params)
        is_ci = other_action.is_ci
        pre_script = ConfigHelper.optional_env('BEFORE_ALL', default: nil)
        other_action.sh(pre_script) if pre_script

        caller_ws = ENV.fetch('CALLER_WORKSPACE', nil)
        check_node_modules(caller_ws) if caller_ws && params[:check_dependencies] != false

        config = other_action.ipc_wrapper(
          event_name: 'Environment loading',
          end_event_name: 'Setup Completed',
          action: proc do
            ConfigHelper.platform_config(platform: :android, export_method: params[:export_method], is_ci: is_ci)
          end
        )

        {
          **config,
          config: config
        }
      end

      def self.description
        'Setup for iOS and Android'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :export_method,
                                       description: 'Export method',
                                       optional: true,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :run_match,
                                       description: 'Run match',
                                       optional: true,
                                       is_string: false,
                                       default_value: true,
                                       type: Boolean),
          FastlaneCore::ConfigItem.new(key: :need_api_key,
                                       description: 'Need API key',
                                       optional: true,
                                       is_string: false,
                                       default_value: true,
                                       type: Boolean),
          FastlaneCore::ConfigItem.new(key: :need_target_list,
                                       description: 'Need target list',
                                       optional: true,
                                       is_string: false,
                                       default_value: true,
                                       type: Boolean),
          FastlaneCore::ConfigItem.new(key: :check_dependencies,
                                       description: 'Check dependencies',
                                       optional: true,
                                       is_string: false,
                                       default_value: true,
                                       type: Boolean),
          FastlaneCore::ConfigItem.new(key: :skip_pods,
                                       description: 'Skip CocoaPods installation',
                                       optional: true,
                                       is_string: false,
                                       default_value: false,
                                       type: Boolean)
        ]
      end

      def self.is_supported?(platform)
        %i[ios android].include?(platform)
      end
    end
  end
end
