# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'

require_relative '../utils/index'

module Fastlane
  module Actions
    class CleanupAction < Action
      def self.run(_params)
        commons = ConfigHelper.common_config()

        output_path_to_delete = "#{commons[:root_dir_name]}/#{commons[:output_path]}"
        paths_to_delete = commons[:cleanup_paths]
        deleted_files = []

        if Dir.exist?(output_path_to_delete) && !commons[:keep_outputs]
          UI.message("🗑️  Deleting output directory: #{output_path_to_delete}...")
          FileUtils.rm_rf(output_path_to_delete)
          deleted_files << output_path_to_delete
        end

        paths_to_delete.each do |path|
          next unless File.exist?(path) && !commons[:keep_outputs]

          UI.message("🗑️  Deleting generated file: #{path}...")
          File.delete(path)
          deleted_files << path
        end

        if deleted_files.any?
          private_keys_dir = commons[:private_keys_path]
          FileUtils.rm_rf(private_keys_dir) if Dir.exist?(private_keys_dir) && Dir.empty?(private_keys_dir)
          UI.success("✅  Cleanup completed. #{deleted_files.size} base64 generated file(s) removed.")
        else
          UI.message('✅  Cleanup completed. No base64 generated files found to remove.')
        end
      end

      def self.description
        'Deletes files created from base64 values during the setup phase'
      end

      def self.available_options
        []
      end

      def self.is_supported?(platform)
        %i[ios android].include?(platform)
      end
    end
  end
end
