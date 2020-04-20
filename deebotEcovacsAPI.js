const ecovacsDeebot = require('ecovacs-deebot'),
  nodeMachineId = require('node-machine-id'),
  countries = ecovacsDeebot.countries,
  EcoVacsAPI = ecovacsDeebot.EcoVacsAPI;

var EventEmitter = require('events');
var inherits = require('util').inherits;

module.exports = {
  DeebotEcovacsAPI: DeebotEcovacsAPI,
};

function DeebotEcovacsAPI(log, platform) {
  EventEmitter.call(this);

  this.log = log;
  this.platform = platform;
  this.login = platform.login;
  this.countryCode = platform.countryCode.toUpperCase();
  this.device_id = EcoVacsAPI.md5(nodeMachineId.machineIdSync());
  this.password_hash = EcoVacsAPI.md5(platform.password);
  this.continent = countries[this.countryCode].continent.toUpperCase();

  this.log('INFO - API :' + this.continent + '/' + this.countryCode);

  this.api = new EcoVacsAPI(this.device_id, this.countryCode, this.continent);

  this.vacbots = [];
}

DeebotEcovacsAPI.prototype = {
  getDeebots: function () {
    this.api
      .connect(this.login, this.password_hash)
      .then(() => {
        this.log.debug('INFO - connected');
        this.api.devices().then((devices) => {
          this.log.debug('INFO - getDeebots :', JSON.stringify(devices));

          for (let s = 0; s < devices.length; s++) {
            let vacuum = devices[s]; // Selects the first vacuum from your account

            let vacbot = this.api.getVacBot(
              this.api.uid,
              EcoVacsAPI.REALM,
              this.api.resource,
              this.api.user_access_token,
              vacuum,
              this.continent
            );
            this.vacbots.push(vacbot);
          }
          this.emit('deebotsDiscovered');
        });
      })
      .catch((e) => {
        // The Ecovacs API endpoint is not very stable, so
        // connecting fails randomly from time to time
        this.log('ERROR - Failure in connecting to ecovacs to retrieve your deebots! - ' + e);
        this.emit('errorDiscoveringDeebots');
      });
  },

  configureEvents(vacBot, HKBatteryService, HKFanService, HKSwitchOnService, HKMotionService) {
    var Characteristic = this.platform.api.hap.Characteristic;
    vacBot.on('ready', (event) => {
      this.log.debug('INFO - Vacbot ready: ' + JSON.stringify(event));

      vacBot.run('GetBatteryState');
      vacBot.run('GetChargeState');
      vacBot.run('GetCleanState');
      vacBot.run('GetCleanSpeed');

      if (vacBot.orderToSend && vacBot.orderToSend !== undefined) {
        this.log('INFO - sendingCommand ' + vacBot.orderToSend);

        if (vacBot.orderToSend instanceof Array) {
          vacBot.run.apply(vacBot, orderToSend);
        } else {
          vacBot.run(vacBot.orderToSend);
        }

        vacBot.orderToSend = undefined;
      }
    });

    vacBot.on('BatteryInfo', (battery) => {
      this.log.debug('INFO - Battery level: %d%', battery);
      let batteryLevel = this.platform.getBatteryLevel(battery);

      let currentValue = HKBatteryService.getCharacteristic(Characteristic.BatteryLevel).value;

      if (currentValue !== batteryLevel) {
        HKBatteryService.setCharacteristic(Characteristic.BatteryLevel, batteryLevel);
        if (batteryLevel < 20)
          HKBatteryService.setCharacteristic(Characteristic.StatusLowBattery, 1);
        else HKBatteryService.setCharacteristic(Characteristic.StatusLowBattery, 0);
      }
    });

    vacBot.on('ChargeState', (charge_status) => {
      this.log.debug('INFO - Charge status: %s', charge_status);
      let charging = charge_status == 'charging';
      let currentValue = HKBatteryService.getCharacteristic(Characteristic.ChargingState).value;

      if (currentValue !== charging) {
        HKBatteryService.setCharacteristic(Characteristic.ChargingState, charging);
      }
      if (charging) {
        let currentOnValue = HKFanService.getCharacteristic(Characteristic.On).value;
        if (currentOnValue) {
          HKFanService.getCharacteristic(Characteristic.On).updateValue(false);
        }
        let currentMainOnValue = HKSwitchOnService.getCharacteristic(Characteristic.On).value;
        if (currentMainOnValue) {
          HKSwitchOnService.getCharacteristic(Characteristic.On).updateValue(false);
        }
      }
    });

    vacBot.on('CleanReport', (clean_status) => {
      this.log.debug('INFO - Clean status: %s', clean_status);

      let cleaning = clean_status != 'stop' && clean_status != 'pause' && clean_status != 'idle';
      let pausedOrStopped =
        clean_status == 'stop' || clean_status == 'pause' || clean_status == 'idle';

      let currentOnValue = HKFanService.getCharacteristic(Characteristic.On).value;
      if (currentOnValue !== cleaning) {
        HKFanService.getCharacteristic(Characteristic.On).updateValue(cleaning);
      }

      let currentMainOnValue = HKSwitchOnService.getCharacteristic(Characteristic.On).value;
      if (currentMainOnValue == pausedOrStopped) {
        HKSwitchOnService.getCharacteristic(Characteristic.On).updateValue(!pausedOrStopped);
      }

      let currentDirectionValue = HKFanService.getCharacteristic(Characteristic.RotationDirection)
        .value;
      if (clean_status == 'edge' && currentDirectionValue == 0) {
        HKFanService.getCharacteristic(Characteristic.RotationDirection).updateValue(0);
      } else if (clean_status != 'edge' && currentDirectionValue == 1) {
        HKFanService.getCharacteristic(Characteristic.RotationDirection).updateValue(1);
      }
    });

    vacBot.on('CleanSpeed', (clean_speed) => {
      let currentSpeedValue = HKFanService.getCharacteristic(Characteristic.RotationSpeed).value;
      let deebotSpeed = this.platform.getCleanSpeed(currentSpeedValue);

      this.log.debug('INFO - Clean speed : %s - %s', clean_speed, deebotSpeed);

      if (deebotSpeed !== clean_speed) {
        let newSpeed = this.platform.getFanSpeed(clean_speed);
        HKFanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(newSpeed);
      }
    });

    vacBot.on('Error', (error_message) => {
      this.log.debug('INFO - Error from deebot : %s ', error_message);

      HKMotionService.getCharacteristic(Characteristic.MotionDetected).updateValue(true);
    });

    if (!vacBot.is_ready) vacBot.connect_and_wait_until_ready();
  },
};

inherits(DeebotEcovacsAPI, EventEmitter);
