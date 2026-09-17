# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'

module Fastlane
  module Actions
    class PipelineAction < Action
      STEPS = %i[
        setup
        install
        prebuild
        build
        postbuild
        prerelease
        release
        postrelease
      ].freeze

      def self.run(params)
        title = resolve_title(params)
        context = (params[:context] || {}).dup
        step_names = params[:steps] || STEPS

        active_steps = step_names.select { |s| params[s] }
        steps_payload = active_steps.map do |s|
          step_title = case s.to_sym
                       when :setup then 'Setup'
                       when :install then 'Install'
                       when :prebuild then 'Prebuild'
                       when :build then 'Build'
                       when :postbuild then 'Postbuild'
                       when :prerelease then 'Prerelease'
                       when :release then 'Release'
                       when :postrelease then 'Postrelease'
                       else s.to_s.split('_').map(&:capitalize).join(' ')
                       end
          { id: s.to_s, title: step_title }
        end

        other_action.ipc_client(
          event_name: 'pipeline_init',
          payload: { steps: steps_payload, title: title }
        )

        UI.header("Starting #{title}")

        step_names.each do |step_name|
          action = params[step_name]
          next unless action

          UI.message("➡️  [Pipeline] Step: #{step_name}")
          ENV['FASTLANE_PIPELINE_STEP'] = step_name.to_s
          other_action.ipc_client(
            event_name: 'pipeline_step_start',
            payload: { step: step_name, start: true, title: title, steps: steps_payload }
          )

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
            other_action.ipc_client(
              event_name: 'pipeline_step_end',
              payload: { step: step_name, end: true, duration: elapsed }
            )
          rescue StandardError => e
            UI.error("❌ [Pipeline] Step failed: #{step_name} - #{e.message}")
            other_action.ipc_client(
              event_name: 'pipeline_step_fail',
              payload: { step: step_name, error: e.message }
            )
            raise e
          ensure
            ENV['FASTLANE_PIPELINE_STEP'] = nil
          end
        end

        UI.header("#{title} Finished Successfully")
        other_action.ipc_client(
          event_name: 'pipeline_finish',
          payload: { ok: true }
        )
        context
      end

      def self.resolve_title(params)
        return params[:title] if params[:title] && !params[:title].to_s.strip.empty?

        platform = lane_context[SharedValues::PLATFORM_NAME] || ENV['FASTLANE_PLATFORM_NAME']
        lane = lane_context[SharedValues::LANE_NAME] || ENV['FASTLANE_LANE_NAME']

        platform_str = case platform.to_s.downcase
                       when 'ios' then 'iOS'
                       when 'android' then 'Android'
                       else platform.to_s.capitalize
                       end

        lane_str = lane.to_s.split.last || ''
        lane_formatted = case lane_str.downcase
                         when 'adhoc' then 'AdHoc'
                         when 'internal' then 'Internal'
                         when 'pod', 'pods' then 'Pod'
                         when 'release' then 'Release'
                         when 'beta' then 'Beta'
                         else lane_str.capitalize
                         end

        if !platform_str.empty? && !lane_formatted.empty?
          "#{platform_str} #{lane_formatted} Pipeline"
        elsif !lane_formatted.empty?
          "#{lane_formatted} Pipeline"
        elsif !platform_str.empty?
          "#{platform_str} Pipeline"
        else
          'Pipeline'
        end
      end

      def self.description
        'Executes a standardized pipeline with live terminal summary'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :title,
                                       description: 'Custom title for pipeline live summary',
                                       optional: true,
                                       is_string: true),
          FastlaneCore::ConfigItem.new(key: :steps,
                                       description: 'Custom step sequence symbols array (defaults to standard pipeline phases)',
                                       optional: true,
                                       is_string: false,
                                       type: Array),
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
          FastlaneCore::ConfigItem.new(key: :install,
                                       description: 'Install step proc (dependencies / pods)',
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
