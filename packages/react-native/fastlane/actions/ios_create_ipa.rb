# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'

module Fastlane
  module Actions
    class IosCreateIpaAction < Action
      def self.run(params)
        export_method = params[:export_method] || 'app-store'
        result = other_action.setup(export_method: export_method)
        targets = result[:targets]
        config = result[:config]
        archive_path = params[:archive_path] || config[:xcarchive_path]
        output_dir = params[:output_dir] || config[:ipa_output_directory]
        formatter = params[:xcodebuild_formatter] || 'xcbeautify --renderer github-actions'

        app_target = targets.find { |t| t[:bundle_id] == config[:app_identifier] }
        version = other_action.get_version_number(xcodeproj: config[:project], target: app_target[:name])
        build_number = other_action.get_build_number(xcodeproj: config[:project])

        other_action.ipc_client(event_name: 'Packaging IPA (xcodebuild)')
        other_action.build_app(
          workspace: config[:workspace],
          scheme: config[:scheme],
          silent: config[:silent],
          configuration: config[:configuration],
          output_name: config[:scheme],
          xcodebuild_formatter: formatter,
          archive_path: archive_path,
          derived_data_path: config[:derived_data_path],
          output_directory: output_dir,
          skip_profile_detection: true,
          skip_build_archive: true,
          skip_codesigning: false,
          skip_package_ipa: false,
          export_method: config[:export_method],
          export_team_id: config[:team_id],
          export_options: {
            method: config[:export_method],
            compile_bitcode: true,
            provisioningProfiles: targets.to_h { |t| [t[:bundle_id], t[:profile_uuid]] }
          }
        )
        other_action.ipc_client(event_name: 'IPA packaged')

        {
          version: version,
          build_number: build_number,
          path: Actions.lane_context[SharedValues::IPA_OUTPUT_PATH]
        }
      end

      def self.description
        'Packages an existing .xcarchive into an .ipa file for iOS'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(
            key: :export_method,
            description: 'Export method (app-store, ad-hoc, development, enterprise)',
            optional: true,
            default_value: 'app-store',
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :archive_path,
            description: 'Path to the .xcarchive to package',
            optional: true,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :output_dir,
            description: 'Output directory for the generated .ipa',
            optional: true,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :xcodebuild_formatter,
            description: 'Formatter tool for xcodebuild output',
            optional: true,
            default_value: 'xcbeautify --renderer github-actions',
            type: String
          )
        ]
      end

      def self.authors
        ['tumerorkun']
      end

      def self.is_supported?(platform)
        platform == :ios
      end
    end
  end
end
