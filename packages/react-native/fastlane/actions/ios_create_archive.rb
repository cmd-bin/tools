# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'

module Fastlane
  module Actions
    class IosCreateArchiveAction < Action
      def self.run(params)
        export_method = params[:export_method] || 'app-store'
        result = other_action.setup(export_method: export_method)
        targets = result[:targets]
        config = result[:config]
        archive_path = params[:archive_path] || config[:xcarchive_path]
        formatter = params[:xcodebuild_formatter] || 'xcbeautify --renderer github-actions'

        app_target = targets.find { |t| t[:bundle_id] == config[:app_identifier] }
        version = other_action.get_version_number(xcodeproj: config[:project], target: app_target[:name])
        build_number = other_action.get_build_number(xcodeproj: config[:project])

        $pbxproj_path ||= File.join(config[:project], 'project.pbxproj')
        $pbxproj_backup ||= File.read($pbxproj_path)
        puts "targets: #{targets}"
        targets.each do |target|
          other_action.update_code_signing_settings(
            path: config[:project],
            use_automatic_signing: false,
            team_id: config[:team_id],
            targets: target[:name],
            code_sign_identity: target[:cert_name],
            bundle_identifier: target[:bundle_id],
            profile_name: target[:profile_name],
            build_configurations: config[:configuration]
          )
        end

        other_action.ipc_client(event_name: 'Code signing settings updated')

        other_action.build_app(
          workspace: config[:workspace],
          scheme: config[:scheme],
          silent: config[:silent],
          configuration: config[:configuration],
          output_name: config[:scheme],
          xcodebuild_formatter: formatter,
          derived_data_path: config[:derived_data_path],
          output_directory: config[:lane_output_directory],
          archive_path: archive_path,
          skip_build_archive: false,
          skip_codesigning: false,
          skip_package_ipa: true
        )

        {
          version: version,
          build_number: build_number,
          archive_path: archive_path
        }
      end

      def self.description
        'Creates an Xcode archive (.xcarchive) for iOS'
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
            description: 'Custom path to output the .xcarchive',
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
