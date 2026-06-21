require 'fastlane/action'
require 'fastlane_core'

module Fastlane
  module Actions
    class SyncAppAssetsAction < Action
      def self.run(params)
        # 1. Setup Environment for Match
        # Match strictly reads MATCH_PASSWORD from ENV
        ENV["MATCH_PASSWORD"] = params[:match_password]

        # 2. Extract Git and App info
        api_key = params[:api_key]
        app_ids = params[:app_identifiers]
        
        UI.message("🔐 Synchronizing Match Repo: #{params[:git_url]} [Branch: #{params[:git_branch] || "main"}]")

        # 3. Execute Match
        other_action.match(
          api_key: api_key,
          git_url: params[:git_url],
          git_branch: params[:git_branch] || "main",
          # match can take a local path to a private key or the key content
          git_private_key: params[:git_private_key], 
          type: params[:type],
          app_identifier: app_ids,
          readonly: params[:readonly],
          force: params[:force_renew]
        )

        UI.success("✅ Match assets are synchronized and installed in Keychain.")
      ensure
        # Best Practice: Clear the password from ENV after execution to prevent 
        # subsequent steps/logs from accessing it.
        ENV.delete("MATCH_PASSWORD")
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :api_key,
                                      description: "ASC API Key",
                                      is_string: false,
                                      optional: false),
          FastlaneCore::ConfigItem.new(key: :app_identifiers,
                                      description: "Array of bundle IDs",
                                      is_string: false,
                                      optional: false),
          FastlaneCore::ConfigItem.new(key: :match_password,
                                      env_name: "MATCH_PASSWORD",
                                      description: "Password to encrypt/decrypt the match repo",
                                      sensitive: true,
                                      optional: false),
          FastlaneCore::ConfigItem.new(key: :git_url,
                                      description: "The URL of the Match storage repo",
                                      optional: false),
          FastlaneCore::ConfigItem.new(key: :git_branch,
                                      description: "The branch to use in the git repo",
                                      default_value: "master"),
          FastlaneCore::ConfigItem.new(key: :git_private_key,
                                      description: "SSH Private Key for Git (Raw content or path)",
                                      sensitive: true,
                                      optional: true),
          FastlaneCore::ConfigItem.new(key: :type,
                                      description: "appstore, adhoc, or development",
                                      default_value: "appstore"),
          FastlaneCore::ConfigItem.new(key: :readonly,
                                      description: "Readonly mode (true for CI)",
                                      is_string: false,
                                      default_value: false),
          FastlaneCore::ConfigItem.new(key: :force_renew,
                                      description: "Force renew assets",
                                      is_string: false,
                                      default_value: false)
        ]
      end

      def self.is_supported?(platform)
        [:ios, :mac].include?(platform)
      end
    end
  end
end