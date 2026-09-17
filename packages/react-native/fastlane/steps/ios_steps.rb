# frozen_string_literal: true

module Steps
  module IOS
    def ios_prebuild_internal(ctx)
      ipc_wrapper(
        event_name: "Fetching TestFlight latest build number for #{ctx[:app_identifier]}",
        end_event_name: 'TestFlight latest build number retrieved',
        action: -> {
          latest_testflight_build_number(
            api_key: ctx[:api_key],
            app_identifier: ctx[:app_identifier],
            initial_build_number: 0
          )
        }
      )

      build_number = lane_context[:LATEST_TESTFLIGHT_BUILD_NUMBER] + 1
      increment_build_number(
        xcodeproj: ctx[:project],
        skip_info_plist: false,
        build_number: build_number
      )

      app_target = ctx[:targets].find { |t| t[:bundle_id] == ctx[:app_identifier] }
      app_name   = ctx[:app_name] || (app_target && app_target[:name]) || ctx[:scheme]
      version    = get_version_number(xcodeproj: ctx[:project], target: app_target[:name])

      {
        build_number: build_number,
        version: version,
        app_target: app_target,
        app_name: app_name
      }
    end

    def ios_prebuild_adhoc(ctx)
      common_prepare_firebase_tester_group(ctx)

      latest_release = firebase_app_distribution_get_latest_release(
        app: ctx[:firebase_app_id],
        service_credentials_file: ctx[:firebase_credentials_path]
      )

      latest_release_build = latest_release&.[](:buildVersion)
      build_number = (latest_release_build ? latest_release_build.to_i : 0) + 1
      increment_build_number(
        xcodeproj: ctx[:project],
        skip_info_plist: false,
        build_number: build_number
      )

      app_target = ctx[:targets].find { |t| t[:bundle_id] == ctx[:app_identifier] }
      app_name   = ctx[:app_name] || (app_target && app_target[:name]) || ctx[:scheme]
      version    = get_version_number(xcodeproj: ctx[:project], target: app_target[:name])

      {
        build_number: build_number,
        version: version,
        app_target: app_target,
        app_name: app_name
      }
    end

    def ios_build(ctx)
      archive_result = ipc_wrapper(
        event_name: "Creating Archive: v#{ctx[:version]}(#{ctx[:build_number]})",
        end_event_name: "Created Archive: v#{ctx[:version]}(#{ctx[:build_number]})",
        action: -> { ios_create_archive(export_method: ctx[:export_method]) }
      )

      ipa_result = ipc_wrapper(
        event_name: "Creating IPA: v#{ctx[:version]}(#{ctx[:build_number]})",
        end_event_name: "Created IPA: v#{ctx[:version]}(#{ctx[:build_number]})",
        action: -> {
          ios_create_ipa(
            export_method: ctx[:export_method],
            archive_path: archive_result[:archive_path]
          )
        }
      )

      {
        archive_result: archive_result,
        ipa_result: ipa_result
      }
    end

    def ios_release_testflight(ctx)
      github_release = ctx[:github_release]
      testflight_params = {
        ipa: ctx.dig(:ipa_result, :path),
        api_key: ctx[:api_key],
        app_identifier: ctx[:app_identifier],
        skip_waiting_for_build_processing: true,
        distribute_external: false
      }

      if ctx[:send_changelog_to_testflight]
        testflight_params[:changelog] = "#{ctx[:release_notes]}#{
          "\nGithub Release(#{github_release['id']}): #{github_release['html_url']}" if github_release
        }"
      end

      ipc_wrapper(
        event_name: 'Uploading to Testflight',
        end_event_name: 'Uploaded to Testflight',
        action: -> { upload_to_testflight(testflight_params) },
        end_payload_proc: ->(_res) {
          {
            version: "v#{ctx[:version]}(#{ctx[:build_number]})",
            console: 'https://appstoreconnect.apple.com/apps'
          }
        }
      )

      { testflight_params: testflight_params }
    end
  end
end
