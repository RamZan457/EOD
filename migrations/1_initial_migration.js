const LMS = artifacts.require("LMS");

module.exports = function (deployer) {
    deployer.deploy(LMS);
};
