const WebSocket = require("ws")
const request = require("request")
const Config = require('electron-config')
const config = new Config()
let wsURL = ''

if (config.has('dev')) {
    if (config.get('dev') === true) {
        wsURL = 'wss://dev.api.fuelrats.com'
    } else {
        wsURL = 'wss://api.fuelrats.com'
    }

} else {
    wsURL = 'wss://api.fuelrats.com'
}


const {LogWatcher} = require("ed-logwatcher")
const DEFAULT_SAVE_DIR = require("path").join(
    require('os').homedir(),
    'Saved Games',
    'Frontier Developments',
    'Elite Dangerous'
)



const ws = new WebSocket(wsURL);
const watcher = new LogWatcher(DEFAULT_SAVE_DIR, 3)

// const sysApi = require("./systemApiHandler")

let connected = false;

ws.on('open', () => {
    ws.send("{\"action\":[\"rescues\",\"read\"],\"meta\":{\"event\":\"rescueRead\"},\"status\":{\"$not\":\"closed\"}}")
});



function getSysInfo (sys) {
    return new Promise((resolve, reject) => {
        try {
            sys = encodeURI(sys.toUpperCase())
        } catch(err) {
            sysInfo = {

                x: undefined,
                y: undefined,
                z: undefined,
                found: false
            }

            resolve(sysInfo)
        }



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
        $scope.jumpRange = config.get('jumpRange', 20)
        $scope.ratSystem = ""

        watcher.on('data', obs => {
            obs.forEach(ob => {
                if (ob.event === "FSDJump") {
                    $timeout(() => {
                        $scope.ratSystem = ob.StarSystem
                    });
                }
            })
        })

        $scope.reCalcJumps = () => {
            if ($scope.jumpRange <= 0) {
                $scope.jumpRange = 1
            }

            config.set('jumpRange', $scope.jumpRange)

            $scope.cases.forEach((caseData) => {
                if (caseData.systemDefined === true) {
                    caseData.jumps = Math.ceil(caseData.distance / $scope.jumpRange)
                }

            })
        }

        ws.on('message', (data) => {

            if (connected === false) {

                console.log("connection established")
                connected = true
            } else {
                jsonData = JSON.parse(data);
                console.log(jsonData.meta)

                if (jsonData.meta.event === "rescueUpdated" || jsonData.meta.event === "rescueRead" || jsonData.meta.event === "rescueCreated") {

                    if (jsonData.meta.event === "rescueCreated") {
                        let jsonDataStore = jsonData.data
                        jsonData.data = []
                        jsonData.data[0] = jsonDataStore
                        console.log(jsonData.data)
                        console.log("sucess")
                    }
                    for (let index = 0; index < jsonData.data.length; index++) {
                        let caseJsonData = jsonData.data[index]


                        let caseData = {
                            caseID: caseJsonData.id,
                            clientNick: caseJsonData.attributes.data.IRCNick,
                            codeRed: caseJsonData.attributes.codeRed,
                            boardIndex: caseJsonData.attributes.data.boardIndex,
                            clientSystem: caseJsonData.attributes.system,
                            caseRed: undefined,
                            numJumps: undefined,
                            distance: undefined,
                            systemDefined: undefined,
                            platformUnknown: undefined

                        }

                        if (caseJsonData.attributes.platform !== 'pc' && caseJsonData.attributes.platform !== null) {
                            let caseIndex = $scope.cases.findIndex((obj) => {
                                console.log(obj)
                                if (obj.caseID === caseData.caseID) {
                                    return true
                                }
                            })

                            if (caseIndex !== -1) {
                                $timeout(() => {
                                    $scope.cases.splice(caseIndex, 1)
                                });
                            }

                            continue
                        }

                        if (caseJsonData.attributes.platform === null) {
                            caseData.platformUnknown = true
                        }

                        if (caseJsonData.attributes.codeRed) {
                            caseData.caseRed = "Yes"
                        } else {
                            caseData.caseRed = "No"
                        }
                        console.log(jsonData)
                        if (caseJsonData.attributes.status !== "open") {
                            console.log("here")
                            let caseIndex = $scope.cases.findIndex((obj) => {
                                if (obj.caseID === caseData.caseID) {
                                    return true
                                }
                            })

                            console.log(caseIndex)

                            if (caseIndex !== -1) {
                                $timeout(() => {
                                    $scope.cases.splice(caseIndex, 1)

                                });
                            }

                        } else {
                            getSysInfo(caseData.clientSystem).then((response) => {
                                if (!response.found) {
                                    console.log("no found")
                                    caseData.systemDefined = false

                                    let caseIndex = $scope.cases.findIndex((obj) => {
                                        if (obj.caseID === caseData.caseID) {
                                            return true
                                        }
                                    })

                                    if (caseIndex === -1) {
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
                                        if (!response.found) {
                                            caseData.systemDefined = false
                                        } else {
                                            let ratSys = response

                                            let distanceAndJumps = calculateJumpsAndDistance(ratSys, clientSys, $scope.jumpRange)

                                            caseData.distance = distanceAndJumps.distance
                                            caseData.jumps = distanceAndJumps.jumps
                                        }
                                        caseData.systemDefined = true
                                        let caseIndex = $scope.cases.findIndex((obj) => {
                                            console.log(obj)
                                            if (obj.caseID === caseData.caseID) {
                                                return true
                                            }
                                        })

                                        if (caseIndex === -1) {
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


                }
            }
        })
    })