# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'

module Fastlane
  module Actions
    class AndroidCreateBundleAction < Action
      def self.run(params)
        export_method = params[:export_method] || 'aab'
        result = other_action.setup(export_method: export_method)
        config = result[:config]

        other_action.ipc_client(
          event_name: "Compiling #{config[:export_method].upcase}"
        )

        other_action.gradle(
          task: config[:task],
          build_type: config[:build_type],
          print_command: false,
          project_dir: config[:project_dir],
          gradle_path: config[:gradle_path],
          flags: '--build-cache --no-daemon',
          properties: {
            'android.injected.signing.store.file' => config[:key_store_path],
            'android.injected.signing.store.password' => config[:key_store_password],
            'android.injected.signing.key.alias' => config[:key_alias],
            'android.injected.signing.key.password' => config[:key_password]
          },
          system_properties: {
            'org.gradle.caching' => 'true',
            'org.gradle.parallel' => 'true',
            'org.gradle.jvmargs' => '-Xmx8192m -XX:MaxMetaspaceSize=4096m'
          }
        )

        other_action.ipc_client(
          event_name: "Created #{config[:export_method].upcase} file"
        )
      end

      def self.description
        'Builds an Android bundle (AAB) or APK using Gradle'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(
            key: :export_method,
            description: 'Export method (aab or apk)',
            optional: true,
            default_value: 'aab',
            type: String
          )
        ]
      end

      def self.authors
        ['tumerorkun']
      end

      def self.is_supported?(platform)
        platform == :android
      end
    end
  end
end
