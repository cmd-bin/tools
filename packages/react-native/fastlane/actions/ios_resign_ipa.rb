# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'

module Fastlane
  module Actions
    class IosResignIpaAction < Action
      def self.run(params)
        export_method = params[:export_method] || 'app-store'
        result = other_action.setup(export_method: export_method)
        targets = result[:targets]
        cert_name = result[:cert_name]
        ipa_path = params[:ipa]

        UI.user_error!('No ipa path provided to ios_resign_ipa') if ipa_path.to_s.strip.empty?

        other_action.resign(
          ipa: ipa_path,
          signing_identity: cert_name,
          provisioning_profile: targets.to_h { |t| [t[:bundle_id], t[:profile_path]] }
        )
      end

      def self.description
        'Resigns an existing .ipa with provisioning profiles and certificate'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(
            key: :ipa,
            description: 'Path to the .ipa file to resign',
            optional: false,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :export_method,
            description: 'Export method (app-store, ad-hoc, development, enterprise)',
            optional: true,
            default_value: 'app-store',
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
