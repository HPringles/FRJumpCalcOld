const WebSocket = require("ws")
const request = require("request")
const {LogWatcher} = require("ed-logwatcher")
const DEFAULT_SAVE_DIR = require("path").join(
    require('os').homedir(),
    'Saved Games',
    'Frontier Developments',
    'Elite Dangerous'
)



const ws = new WebSocket('wss://dev.api.fuelrats.com');
const watcher = new LogWatcher(DEFAULT_SAVE_DIR, 3)

// const sysApi = require("./systemApiHandler")

let connected = false;

ws.on('open', () => {
    console.log("open")
});


function getSysInfo (sys) {
    return new Promise((resolve, reject) => {
        sys = encodeURI(sys.toUpperCase())

            request("https://system.api.fuelrats.com/systems?filter[name:eq]=" + sys + "&include=bodies.stations", {json: true}, (err, res, body) => {
                if (err) {reject(err)}

                if (body.data[0]) {
                    sysInfo = {

                        x: body.data[0].attributes.x,
                        y: body.data[0].attributes.y,
                        z:body.data[0].attributes.z,
                        found: true
                    }
                } else {
                    sysInfo = {

                        x: undefined,
                        y: undefined,
                        z: undefined,
                        found: false
                    }
                }



                resolve(sysInfo)
            })


    })
}



function calculateJumpsAndDistance(currentSys, targetSys, jumpRange) {
    let deltaX = currentSys.x - targetSys.x
    let deltaY = currentSys.y - targetSys.y
    let deltaZ = currentSys.z - targetSys.z

    let distanceToRescue = Math.round(Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2))
    let jumpsToRescue = Math.ceil(distanceToRescue/jumpRange)

    return {
        distance: distanceToRescue,
        jumps: jumpsToRescue
    }


}











angular.module('FRJump', [])
    .controller('frjController', ($scope, $timeout) => {
        $scope.cases = []
        $scope.jumpRange = 20
        $scope.ratSystem = ""

        watcher.on('data', obs => {
            obs.forEach(ob => {
                if (ob.event === "FSDJump"){
                    $timeout(() => {
                        $scope.ratSystem = ob.StarSystem
                    });
                }
            })
        })

        ws.on('message', (data) => {
            if (connected === false) {
                console.log("connection established")
                connected = true
            } else {
                jsonData = JSON.parse(data);
                let caseData = {}

                if (jsonData.meta.event === "rescueUpdated") {
                    caseData = {
                        caseID: jsonData.data[0].id,
                        clientNick: jsonData.data[0].attributes.data.IRCNick,
                        codeRed: jsonData.data[0].attributes.codeRed,
                        boardIndex: jsonData.data[0].attributes.data.boardIndex,
                        clientSystem: jsonData.data[0].attributes.system,
                        numJumps: undefined,
                        distance: undefined,
                        systemDefined: undefined

                    }

                    getSysInfo(caseData.clientSystem).then((response) => {
                        if (!response.found){
                            console.log("no found")
                            caseData.systemDefined = false

                            let caseIndex = $scope.cases.findIndex((obj) => {
                                if (obj.caseID === caseData.caseID){
                                    return true
                                }
                            })

                            if (caseIndex === -1){
                                $timeout(() => {
                                    $scope.cases.push(caseData)
                                });
                            } else {
                                $timeout(() => {
                                    $scope.cases[caseIndex] = caseData
                                });
                            }




                        } else {
                            let clientSys = response

                            getSysInfo($scope.ratSystem).then((response) => {
                                if (!response.found){
                                    caseData.systemDefined = false
                                } else {
                                    let ratSys = response

                                    let distanceAndJumps = calculateJumpsAndDistance(ratSys, clientSys, $scope.jumpRange)

                                    caseData.distance = distanceAndJumps.distance
                                    caseData.jumps = distanceAndJumps.jumps
                                }

                                let caseIndex = $scope.cases.findIndex((obj) => {
                                    console.log(obj)
                                    if (obj.caseID === caseData.caseID){
                                        return true
                                    }
                                })

                                if (caseIndex === -1){
                                    $timeout(() => {
                                        $scope.cases.push(caseData)
                                    });
                                } else {
                                    $timeout(() => {
                                        $scope.cases[caseIndex] = caseData
                                    });
                                }
                            })
                        }



                    }, (error) => {

                        console.log(error)

                    })

                }
            }
        })
    });