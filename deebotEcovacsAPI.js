const sucks = require('sucks'),
  nodeMachineId = require('node-machine-id'),
  countries = sucks.countries,
  EcoVacsAPI = sucks.EcoVacsAPI,
  VacBot = sucks.VacBot;

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
}

DeebotEcovacsAPI.prototype = {
  authenticate: function (callback) {
    callback();
  },

  getDeebots: function () {
    this.api
      .connect(this.login, this.password_hash)
      .then(() => {
        this.log.debug('INFO - connected');
        this.api.devices().then((devices) => {
          this.log.debug('INFO - getDeebots :', JSON.stringify(devices));

          let vacbots = [];
          for (let s = 0; s < devices.length; s++) {
            let vacuum = devices[s]; // Selects the first vacuum from your account
            let vacbot = new VacBot(
              this.api.uid,
              EcoVacsAPI.REALM,
              this.api.resource,
              this.api.user_access_token,
              vacuum,
              this.continent
            );
            vacbots.push(vacbot);
          }
          this.emit('deebotsDiscovered', vacbots);
        });
      })
      .catch((e) => {
        // The Ecovacs API endpoint is not very stable, so
        // connecting fails randomly from time to time
        this.log('ERROR - Failure in connecting to ecovacs to retrieve your deebots! - ' + e);
        callback(undefined);
      });
  },

  sendCommand: function (homebridgeAccessory, command, characteristic, callback) {
    callback();
  },
};

inherits(DeebotEcovacsAPI, EventEmitter);
