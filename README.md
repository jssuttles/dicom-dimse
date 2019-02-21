DIMSE in ES6
============

This is a library that implements dimse tcp protocol.

** Replaced futures with promises

##Usage

For Peers  
DIMSE.default.connection.addPeer({aeTitle: '<AE_TITLE>', host: '< HOST>', port: '< PORT>', default: true});

For current server  
DIMSE.default.connection.addPeer({aeTitle: '<AE_TITLE>', host: '< HOST>', port: '< PORT>', default: true, server: true})

To query  
DIMSE.default.retrieveStudies({0x00100010: '<PATIENT_NAME_QUERY>'}).then(console.log, console.log)