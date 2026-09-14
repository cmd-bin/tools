# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'

module Fastlane
  module Actions
    class PipelineAction < Action
      STEPS = %i[
        setup
        prebuild
        build
        postbuild
        prerelease
        release
        postrelease
      ].freeze

      def self.run(params)
        context = (params[:context] || {}).dup
        step_names = STEPS

        UI.header('Starting Pipeline')

        step_names.each do |step_name|
          action = params[step_name]
          next unless action

          UI.message("➡️  [Pipeline] Step: #{step_name}")
          # other_action.ipc_client(
          #   event_name: "Pipeline Step: #{step_name}",
          #   payload: { step: step_name, start: true }
          # )

          start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

          begin
            result = if action.arity.zero?
                       action.call
                     else
                       action.call(context)
                     end

            context.merge!(result) if result.is_a?(Hash)

            elapsed = (Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time).round(2)
            UI.success("✅ [Pipeline] Step completed: #{step_name} (#{elapsed}s)")
            # other_action.ipc_client(
            #   event_name: "Pipeline Step: #{step_name}",
            #   payload: { step: step_name, end: true, duration: elapsed }
            # )
          rescue StandardError => e
            UI.error("❌ [Pipeline] Step failed: #{step_name} - #{e.message}")
            # other_action.ipc_client(
            #   event_name: "Pipeline Step Failed: #{step_name}",
            #   payload: { step: step_name, error: e.message }
            # )
            raise e
          end
        end

        UI.header('Pipeline Finished Successfully')
        context
      end

      def self.description
        'Executes a standardized 7-phase build and release pipeline'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :context,
                                       description: 'Initial context hash to pass into steps',
                                       optional: true,
                                       is_string: false,
                                       default_value: {}),
          FastlaneCore::ConfigItem.new(key: :setup,
                                       description: 'Setup step proc (env, certs, keys)',
                                       optional: true,
                                       is_string: false,
                                       type: Proc),
          FastlaneCore::ConfigItem.new(key: :prebuild,
                                       description: 'Prebuild step proc (build number, versioning)',
                                       optional: true,
                                       is_string: false,
                                       type: Proc),
          FastlaneCore::ConfigItem.new(key: :build,
                                       description: 'Build step proc (archive/gradle/ipa/apk/aab)',
                                       optional: true,
                                       is_string: false,
                                       type: Proc),
          FastlaneCore::ConfigItem.new(key: :postbuild,
                                       description: 'Postbuild step proc (zip, changelog)',
                                       optional: true,
                                       is_string: false,
                                       type: Proc),
          FastlaneCore::ConfigItem.new(key: :prerelease,
                                       description: 'Prerelease step proc (GitHub release, tag)',
                                       optional: true,
                                       is_string: false,
                                       type: Proc),
          FastlaneCore::ConfigItem.new(key: :release,
                                       description: 'Release step proc (Store/Firebase upload)',
                                       optional: true,
                                       is_string: false,
                                       type: Proc),
          FastlaneCore::ConfigItem.new(key: :postrelease,
                                       description: 'Postrelease step proc (cleanup, notification)',
                                       optional: true,
                                       is_string: false,
                                       type: Proc)
        ]
      end

      def self.authors
        ['tumerorkun']
      end

      def self.step_text
        nil
      end

      def self.is_supported?(_platform)
        true
      end
    end
  end
end
