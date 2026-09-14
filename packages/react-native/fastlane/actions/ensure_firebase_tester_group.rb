# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'

module Fastlane
  module Actions
    class EnsureFirebaseTesterGroupAction < Action
      def self.run(params)
        groups = parse_groups(params[:groups])
        if groups.empty?
          UI.message('No Firebase tester groups specified to ensure.')
          return []
        end

        project_number = extract_project_number(params)
        unless project_number
          UI.important('Could not determine Firebase project_number. Skipping group verification.')
          return []
        end

        credentials_file = params[:service_credentials_file]
        ensure_groups(
          groups: groups,
          project_number: project_number,
          credentials_file: credentials_file,
          fail_on_error: params[:fail_on_error],
          debug: params[:debug] || false
        )
      end

      def self.parse_groups(raw_groups)
        groups = raw_groups.is_a?(String) ? raw_groups.split(',') : (raw_groups || [])
        groups.map { |g| g.to_s.strip }.reject(&:empty?)
      end

      def self.extract_project_number(params)
        project_number = params[:project_number]
        return project_number.to_i if project_number && !project_number.to_s.strip.empty?

        app_id = params[:app]
        extracted = app_id.to_s.split(':')[1] if app_id
        extracted && !extracted.strip.empty? ? extracted.to_i : nil
      end

      def self.ensure_groups(groups:, project_number:, credentials_file:, fail_on_error:, debug:)
        created_or_verified = []

        groups.each do |group_alias|
          other_action.firebase_app_distribution_create_group(
            project_number: project_number,
            alias: group_alias,
            display_name: group_alias.capitalize,
            service_credentials_file: credentials_file,
            debug: debug
          )
          created_or_verified << group_alias
        rescue StandardError => e
          UI.error("Failed to ensure Firebase tester group '#{group_alias}': #{e.message}")
          raise e if fail_on_error
        end

        created_or_verified
      end

      def self.description
        'Ensures Firebase App Distribution tester groups exist, creating them if they do not'
      end

      def self.authors
        ['tumerorkun']
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(
            key: :groups,
            description: 'Comma-separated string or array of tester group aliases',
            optional: true,
            is_string: false
          ),
          FastlaneCore::ConfigItem.new(
            key: :app,
            description: 'Firebase App ID (used to extract project number)',
            optional: true,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :project_number,
            description: 'Firebase project number (extracted from app id if not provided)',
            optional: true,
            type: Integer
          ),
          FastlaneCore::ConfigItem.new(
            key: :service_credentials_file,
            description: 'Path to Google service credentials file',
            optional: true,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :fail_on_error,
            description: 'Whether to raise an error if group creation fails',
            optional: true,
            is_string: false,
            default_value: false,
            type: Boolean
          ),
          FastlaneCore::ConfigItem.new(
            key: :debug,
            description: 'Print verbose debug output',
            optional: true,
            is_string: false,
            default_value: false,
            type: Boolean
          )
        ]
      end

      def self.example_code
        [
          'ensure_firebase_tester_group(
            groups: "internal-testers,qa",
            app: "1:1234567890:android:abcdef",
            service_credentials_file: "path/to/creds.json"
          )'
        ]
      end

      def self.is_supported?(_platform)
        true
      end
    end
  end
end
