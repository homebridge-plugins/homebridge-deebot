import type { PlatformConfig } from 'homebridge'

export type AreaType = 'spotArea' | 'customArea'

export type AirDryingSwitch = 'presetting' | 'yes' | 'no'

export interface DeviceConfig {
  label?: string
  deviceId?: string
  ignoreDevice?: boolean
  pollInterval?: number
  hideMotionSensor?: boolean
  motionDuration?: number
  lowBattThreshold?: number
  showMotionLowBatt?: boolean
  showBattHumidity?: boolean
  showAirDryingSwitch?: AirDryingSwitch
  supportTrueDetect?: boolean
  areaType1?: AreaType
  spotAreaIDs1?: string
  customAreaCoordinates1?: string
  areaNote1?: string
  areaType2?: AreaType
  spotAreaIDs2?: string
  customAreaCoordinates2?: string
  areaNote2?: string
  areaType3?: AreaType
  spotAreaIDs3?: string
  customAreaCoordinates3?: string
  areaNote3?: string
  areaType4?: AreaType
  spotAreaIDs4?: string
  customAreaCoordinates4?: string
  areaNote4?: string
  areaType5?: AreaType
  spotAreaIDs5?: string
  customAreaCoordinates5?: string
  areaNote5?: string
  areaType6?: AreaType
  spotAreaIDs6?: string
  customAreaCoordinates6?: string
  areaNote6?: string
  areaType7?: AreaType
  spotAreaIDs7?: string
  customAreaCoordinates7?: string
  areaNote7?: string
  areaType8?: AreaType
  spotAreaIDs8?: string
  customAreaCoordinates8?: string
  areaNote8?: string
  areaType9?: AreaType
  spotAreaIDs9?: string
  customAreaCoordinates9?: string
  areaNote9?: string
  areaType10?: AreaType
  spotAreaIDs10?: string
  customAreaCoordinates10?: string
  areaNote10?: string
  areaType11?: AreaType
  spotAreaIDs11?: string
  customAreaCoordinates11?: string
  areaNote11?: string
  areaType12?: AreaType
  spotAreaIDs12?: string
  customAreaCoordinates12?: string
  areaNote12?: string
  areaType13?: AreaType
  spotAreaIDs13?: string
  customAreaCoordinates13?: string
  areaNote13?: string
  areaType14?: AreaType
  spotAreaIDs14?: string
  customAreaCoordinates14?: string
  areaNote14?: string
  areaType15?: AreaType
  spotAreaIDs15?: string
  customAreaCoordinates15?: string
  areaNote15?: string
}

export interface EcovacsConfig extends PlatformConfig {
  useYeedi?: boolean
  countryCode: string
  username: string
  password: string
  verificationCode?: string
  disableDeviceLogging?: boolean
  devices?: DeviceConfig[]
}
