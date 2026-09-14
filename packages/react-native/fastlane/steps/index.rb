# frozen_string_literal: true

require_relative 'common_steps'
require_relative 'ios_steps'
require_relative 'android_steps'

module Fastlane
  class FastFile
    include Steps::Common
    include Steps::IOS
    include Steps::Android
  end
end
