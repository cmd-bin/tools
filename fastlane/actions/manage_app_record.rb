require 'fastlane/action'
require 'fastlane_core'
require 'spaceship'

module Fastlane
  module Actions
    class ManageAppRecordAction < Action
      def self.run(params)
        # 1. Initialize Token from Hash
        key_info = params[:api_key]
        token = key_info.is_a?(Hash) ? Spaceship::ConnectAPI::Token.create(**key_info) : key_info
        Spaceship::ConnectAPI.token = token

        bundle_id = params[:app_identifier]
        action_type = params[:action].to_s.downcase

        case action_type
        when 'create'
          create_app_record(bundle_id, params[:app_name], params[:sku], params[:primary_locale])
        when 'delete'
          delete_app_record(bundle_id)
        else
          UI.user_error!("❌ Invalid action: #{action_type}. Use 'create' or 'delete'.")
        end
      end

def self.create_app_record(bundle_id, name, sku, locale)
  UI.message("🚀 Creating App Store Connect record for #{bundle_id}...")
  
  # Ensure the Bundle ID exists
  res = Spaceship::ConnectAPI::BundleId.find(bundle_id)
  UI.user_error!("Bundle ID #{bundle_id} not found!") unless res

  begin
    # Use the high-level Spaceship::ConnectAPI::App.create helper.
    # Passing the platforms array fixes the 'each' for nil error that occurred internally.
    Spaceship::ConnectAPI::App.create(
      name: name,
      version_string: "1.0",
      sku: sku || "#{bundle_id}_#{Time.now.to_i}", # Fallback unique SKU
      primary_locale: locale || "en-US",
      bundle_id: bundle_id,
      platforms: [Spaceship::ConnectAPI::Platform::IOS]
    )
    UI.success("✅ App Store Connect record created successfully.")
  rescue => e
    UI.error("❌ Failed to create App Record: #{e.message}")
  end
end

      def self.delete_app_record(bundle_id)
        UI.message("🗑️ Searching for App Record: #{bundle_id}...")
        
        # 1. Find the App
        app = Spaceship::ConnectAPI::App.find(bundle_id)
        
        if app
          begin
            # 2. Delete the App Record
            # Per Apple rules: Only works if never approved or submitted
            Spaceship::ConnectAPI.tunes_request_client.delete("v1/apps/#{app.id}")
            UI.success("✅ Successfully deleted App Store Connect record for #{bundle_id}")
          rescue => e
            UI.error("❌ Failed to delete App Record: #{e.message}")
            UI.important("Note: If a build was ever uploaded, you must expire it in TestFlight first.")
          end
        else
          UI.important("⚠️ No App Store Connect record found for #{bundle_id}.")
        end
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :api_key, 
                                      is_string: false, 
                                      optional: false),
          FastlaneCore::ConfigItem.new(key: :app_identifier, 
                                      optional: false),
          FastlaneCore::ConfigItem.new(key: :action, 
                                      default_value: "create"),
          FastlaneCore::ConfigItem.new(key: :app_name, 
                                      optional: true),
          FastlaneCore::ConfigItem.new(key: :sku, 
                                      optional: true, 
                                      description: "Unique SKU for the app"),
          FastlaneCore::ConfigItem.new(key: :primary_locale, 
                                      default_value: "en-US")
        ]
      end

      def self.is_supported?(platform)
        [:ios, :mac].include?(platform)
      end
    end
  end
end