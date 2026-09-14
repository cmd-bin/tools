# frozen_string_literal: true

module Steps
  module Android
    def android_prebuild_internal(ctx)
      FileHelper.decode_base64_to_file(
        ctx[:play_store_credentials_base64],
        ctx[:play_store_credentials_path]
      )

      version_name = android_get_version_name(gradle_file: ctx[:app_gradle_file_path])

      play_console_info = check_google_play_console(
        package_name: ctx[:app_identifier],
        track: 'internal',
        credentials_path: ctx[:play_store_credentials_path]
      )

      new_build_number = play_console_info[:version_code] + 1

      android_set_version_code(
        version_code: new_build_number,
        gradle_file: ctx[:app_gradle_file_path]
      )

      {
        version_name: version_name,
        new_build_number: new_build_number,
        play_console_info: play_console_info
      }
    end

    def android_prebuild_adhoc(ctx)
      common_prepare_firebase_tester_group(ctx)

      version_name = android_get_version_name(gradle_file: ctx[:app_gradle_file_path])

      latest_release = firebase_app_distribution_get_latest_release(
        app: ctx[:firebase_app_id],
        service_credentials_file: ctx[:firebase_credentials_path]
      )

      latest_release_build = latest_release&.[](:buildVersion)
      new_build_number = (latest_release_build ? latest_release_build.to_i : 0) + 1

      android_set_version_code(
        version_code: new_build_number,
        gradle_file: ctx[:app_gradle_file_path]
      )

      {
        version_name: version_name,
        new_build_number: new_build_number
      }
    end

    def android_build(ctx)
      ipc_wrapper(
        event_name: "Building: v#{ctx[:version_name]}(#{ctx[:new_build_number]})",
        end_event_name: "Build: v#{ctx[:version_name]}(#{ctx[:new_build_number]})",
        action: -> { android_create_bundle(export_method: ctx[:export_method]) }
      )

      {
        apk_path: lane_context[Fastlane::Actions::SharedValues::GRADLE_APK_OUTPUT_PATH],
        aab_path: lane_context[Fastlane::Actions::SharedValues::GRADLE_AAB_OUTPUT_PATH]
      }
    end

    def android_release_play_store(ctx)
      play_store_params = {
        package_name: ctx[:app_identifier],
        track: ctx[:play_store_track],
        release_status: ctx[:play_store_release_status],
        json_key: ctx[:play_store_credentials_path]
      }

      if ctx[:export_method] == 'apk'
        play_store_params[:apk] = ctx[:apk_path]
        play_store_params[:skip_upload_aab] = true
      else
        play_store_params[:aab] = ctx[:aab_path]
        play_store_params[:skip_upload_apk] = true
      end

      ipc_wrapper(
        event_name: 'Uploading to Play Store',
        end_event_name: 'Uploaded to Play Store',
        action: -> { upload_to_play_store(play_store_params) }
      )

      { play_store_params: play_store_params }
    end
  end
end
