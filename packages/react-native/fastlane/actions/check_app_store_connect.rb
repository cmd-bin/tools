# frozen_string_literal: true

require_relative '../utils/config_helper'

module Fastlane
  module Actions
    # Verifies App Store Connect access by reading the latest TestFlight build number.
    class CheckAppStoreConnectAction < Action
      def self.run(params)
        Actions.lane_context[:PLATFORM_NAME] = :ios

        result = other_action.setup(export_method: 'app-store', run_match: false, need_target_list: false)
        config        = result[:config]
        api_key       = result[:api_key]

        app_identifier = params[:app_identifier] || config[:app_identifier]
        if app_identifier.to_s.strip.empty?
          UI.user_error!('app_identifier is missing! Please provide it in project, .env.deploy or pass app_identifier:com.example.app')
        end

        other_action.ipc_client(
          event_name: "Fetching TestFlight latest build number for #{app_identifier}",
          payload: { start: true }
        )

        other_action.latest_testflight_build_number(
          api_key: api_key,
          app_identifier: app_identifier,
          initial_build_number: 0
        )

        build_number = Actions.lane_context[:LATEST_TESTFLIGHT_BUILD_NUMBER].to_i
        version = Actions.lane_context[:LATEST_TESTFLIGHT_VERSION].to_s

        other_action.ipc_client(
          event_name: "TestFlight build info retrieved for #{app_identifier}",
          payload: {
            end: true,
            list: [
              {
                app_identifier: app_identifier,
                version: version.empty? ? 'none' : version,
                build_number: build_number.to_s
              }
            ]
          }
        )

        {
          app_identifier: app_identifier,
          build_number: build_number,
          version: version,
          api_key: api_key
        }
      end

      def self.description
        'Resolves the latest TestFlight build number to verify App Store Connect access'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(
            key: :app_identifier,
            description: 'Bundle ID / App Identifier to check in App Store Connect',
            optional: true,
            type: String
          )
        ]
      end

      def self.return_value
        'Latest TestFlight build info for the current app'
      end

      def self.authors
        ['tumerorkun']
      end

      # Fastlane action API requires `is_supported?`.
      def self.is_supported?(platform)
        platform == :ios
      end
      # rubocop:enable Naming/PredicatePrefix
    end
  end
end
