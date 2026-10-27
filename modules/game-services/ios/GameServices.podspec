Pod::Spec.new do |s|
  s.name           = 'GameServices'
  s.version        = '1.0.0'
  s.summary        = 'Game Center and Play Games sign-in and leaderboards for MeterZone'
  s.description    = 'Game Center and Play Games sign-in and leaderboards for MeterZone'
  s.license        = 'MIT'
  s.author         = 'MeterZone'
  s.homepage       = 'https://github.com/diogomartf/meterzone'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'GameKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
