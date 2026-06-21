require 'fastlane/action'
require 'fastlane_core'
require 'spaceship'

module Fastlane
  module Actions
    class ManageAppIdentifierAction < Action
      def self.run(params)
        # 1. Get the hash from params
        key_info = params[:api_key]

        # 2. Check if it's already a Token object or still a Hash
        # If it's a Hash (which it usually is when passed as a param), convert it.
        token = if key_info.kind_of?(Hash)
                  Spaceship::ConnectAPI::Token.create(**key_info)
                else
                  key_info
                end

        # 3. Assign the actual Token object to Spaceship
        Spaceship::ConnectAPI.token = token

        # Now you can safely call find, create, or delete
        app_id = params[:app_identifier]
        action_type = params[:action].to_s.downcase

        case action_type
        when 'create'
          create_app(app_id, params[:app_name])
        when 'delete'
          delete_app(app_id)
        else
          UI.user_error!("❌ Invalid action: #{action_type}. Use 'create' or 'delete'.")
        end
      end

      def self.create_app(bundle_id, name)
        UI.message("🚀 Creating App Identifier: #{bundle_id}...")
        
        # Check if it already exists to prevent errors
        existing_app = Spaceship::ConnectAPI::BundleId.find(bundle_id)
        if existing_app
          UI.important("⚠️ App Identifier #{bundle_id} already exists. Skipping.")
          return
        end

        # Create the Bundle ID on the Developer Portal
        # Note: 'produce' usually does this + App Store Connect entry. 
        # Here we use Spaceship for direct Portal control.
        bundle = Spaceship::ConnectAPI::BundleId.create(
          identifier: bundle_id,
          name: name || bundle_id,
          platform: Spaceship::ConnectAPI::Platform::IOS
        )

        UI.message("⚙️ Adding In-App Purchase capability...")
        bundle.create_capability(Spaceship::ConnectAPI::BundleIdCapability::Type::IN_APP_PURCHASE)

        UI.message("⚙️ Adding Push Notifications capability...")
        bundle.create_capability(Spaceship::ConnectAPI::BundleIdCapability::Type::PUSH_NOTIFICATIONS)

        UI.success("✅ Created #{bundle_id}")
      end

      def self.delete_app(bundle_id)
        UI.message("🗑️ Finalizing deletion of #{bundle_id}...")
        
        # 1. Fetch the object to get the Internal ID (required by the API)
        # Based on connect_api.rb, BundleId is the correct model
        bundle_id_object = Spaceship::ConnectAPI::BundleId.find(bundle_id)
        
        if bundle_id_object
          id = bundle_id_object.id
          
          begin
            # Directly delete using the provisioning request client with the correct API version (v1)
            Spaceship::ConnectAPI.provisioning_request_client.delete("v1/bundleIds/#{id}")
            UI.success("✅ Deleted Bundle ID: #{bundle_id}")
          rescue => final_e
            UI.user_error!("Apple API Error: #{final_e.message}")
          end
        else
          UI.important("⚠️ Bundle ID not found; it may have already been deleted.")
        end
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :api_key,
                                      description: "ASC API Key",
                                      is_string: false,
                                      optional: false),
          FastlaneCore::ConfigItem.new(key: :app_identifier,
                                      description: "The bundle ID (e.g. com.example.app)",
                                      optional: false),
          FastlaneCore::ConfigItem.new(key: :action,
                                      description: "The action to perform: 'create' or 'delete'",
                                      default_value: "create"),
          FastlaneCore::ConfigItem.new(key: :app_name,
                                      description: "The name of the app (required for create)",
                                      optional: true)
        ]
      end

      def self.is_supported?(platform)
        [:ios, :mac].include?(platform)
      end
    end
  end
end