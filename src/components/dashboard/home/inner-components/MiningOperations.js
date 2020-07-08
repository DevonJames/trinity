
import React, { useState, useEffect, useRef } from 'react';
import { API_URL, WEB_SOCKET_URL } from '../../../../../config.js';
import { updateDailyBudget, isNiceHashMinimum } from '../../../../actions/miningOperationsActions.js';
import ToggleSwitch from '../../../helpers/toggle/ToggleSwitch';
import { connect } from 'react-redux';
import MarketsNPools from '../../../settings/prefrences/merc/MercMode'
import { isEqual } from 'lodash'

const MiningOperations = (props) => {
    const socket = useRef(null)
    const user_id = useRef(null)

    function connectSocket(){
        socket.current = new WebSocket(WEB_SOCKET_URL);
        socket.current.onclose = (e) => {
            console.log('onClose:')
            if(socket.current) {
                console.log('Going to try and connect again')
                connectSocket()
            }
        }
        socket.current.onopen = (e) => {
            socket.current.send(JSON.stringify({ action: 'connect' }));
        };
    }
   
    useEffect(() => {
        connectSocket()
        return () => {
            // When MiningOperations unmounts it wont let the timer update and run to prevent memory leaks
            socket.current.close()
            socket.current = false
        }
    }, [])
    
    if (socket.current) {
        socket.current.onmessage = (e) => {
            if (e.data === '__ping__') {
                console.log('Still alive')
                socket.current.send(JSON.stringify({ keepAlive: true }));
            } else {
                let message = JSON.parse(e.data)
                    if(message.userId === user_id.current) {
                    processReturnData(message)
                }
            }
        }
    }


    const [showSettingaModal, setShowSettingsModal] = useState(false)
    const [err, setError] = useState({ autoRent: false, autoTrade: false })
    const [miningOperations, setOperations] = useState({
        targetMargin: 0,
        profitReinvestment: 0,
        updateUnsold: '',
        dailyBudget: 0,
        autoRent: false,
        spot: false,
        alwaysMineXPercent: false,
        autoTrade: false,
        morphie: false,
        supportedExchange: false,
        Xpercent: 15,
        token: '',
        message: [],
        update: false,
        CostOfRentalBtc: '',
        userId: '',
        mining: false
    });

    let {
        targetMargin, profitReinvestment, updateUnsold, dailyBudget, autoRent, spot, alwaysMineXPercent, autoTrade,
        morphie, supportedExchange, Xpercent, token, mining
    } = miningOperations

    useEffect(() => {

        if (props.user && props.profile) {
            const {
                targetMargin, profitReinvestment, updateUnsold, dailyBudget, autoRent, autoTrade, token, name, _id
            } = props.profile
            
            let profile = {
                targetMargin: targetMargin,
                profitReinvestment: profitReinvestment,
                updateUnsold: updateUnsold,
                dailyBudget: dailyBudget,
                autoRent: autoRent.on,
                spot: autoRent.mode.spot,
                alwaysMineXPercent: autoRent.mode.alwaysMineXPercent.on,
                Xpercent: autoRent.mode.alwaysMineXPercent.Xpercent,
                autoTrade: autoTrade.on,
                morphie: autoTrade.mode.morphie,
                supportedExchange: autoTrade.mode.supportedExchanges,
                token: token,
                name,
                profile_id: _id,
                userId: props.user._id
            }

            props.dispatch(updateDailyBudget({...profile, userId: props.user._id, profile_id: props.profile._id}))
            setOperations({...miningOperations, ...profile })
            user_id.current = props.user._id

        } else {
            setOperations({
                targetMargin: 0,
                profitReinvestment: 0,
                updateUnsold: '0',
                dailyBudget: dailyBudget,
                autoRent: false,
                spot: false,
                alwaysMineXPercent: true,
                autoTrade: false,
                morphie: false,
                supportedExchange: false,
                Xpercent: 0,
                token: '',
                message: [],
                update: false,
                CostOfRentalBtc: '',
                userId: '',
                mining: false
            })
        }
    }, [props.profile, props.address])

    useEffect((prevProf = props.profile) => {
        
        let formatedState = {
            profile: {
                autoRent: {
                    mode: {
                        spot,
                        alwaysMineXPercent: {
                            on: alwaysMineXPercent,
                            Xpercent,
                        }
                    },
                    on: autoRent,
                },
                autoTrade: {
                    mode: {
                        morphie,
                        supportedExchanges: supportedExchange
                    },
                    on: autoTrade
                },
                targetMargin,
                profitReinvestment,
                updateUnsold,
                dailyBudget,
            }
        }
        let profile = { ...props.profile, ...formatedState.profile }

        if (isEqual(prevProf, profile)) {
            return;
        }

        props.updateProfile(profile)

        if (miningOperations.autoRent) {
            // If update has a value of true it removes back to undefined to be updated once again on the backend
            setOperations({ ...miningOperations, message: [], update: false, mining: false })
            rent(miningOperations)
        }
    }, [autoRent]);

    useEffect(() => {
        if (!props.dailyBudget) return
        setOperations({ ...miningOperations, dailyBudget: props.dailyBudget })
    }, [props.dailyBudget])

    const processReturnData = (data) => {
        let newValues = {}

        for (let key in data) {
            if (key === 'Xpercent') {
                newValues[key] = Number(data[key])
            } else if (key === 'message') {
                let message = miningOperations.message.concat(data[key])
                newValues[key] = message
            } else if (key === 'update') {
                newValues[key] = data[key]
            } else if (key === 'autoRent') {
                newValues[key] = data[key]
            } else if (key === 'mining') {
                newValues[key] = data[key]
            } else if (key === 'db') {
                for (let key in data.db) {
                    newValues[key] = data.db[key]
                }
            }
        }
        setOperations({ ...miningOperations, ...newValues })
    }

    const rent = (options) => {
        options.to_do = 'rent'
        options.userId = props.user._id
        options.message = []
        options.update = false

        fetch(API_URL + '/rent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('token')
            },
            body: JSON.stringify(options)
        }).then((response) => {
            return response.json();
        }).then((data) => {
            console.log('Response data from renting:', data)
        }).catch((err) => {
            console.log(err)
        });
    }

    // const trade = (profileID) => {
    //     console.log(profileID)

    //     fetch(API_URL+'/auto-trade/on/'+profileID, {
    //         method: 'GET',
    //         headers: {
    //             'Content-Type': 'application/json',
    //             'x-auth-token': localStorage.getItem('token')
    //         },
    //     }).then((response) => {
    //         return response.json();
    //     })
    //       .then((data) => {
    //         console.log(data);
    //     }).catch((err)=> {
    //           console.log(err)
    //     });
    // }



    // When slider is clicked to switch it checks to make sure inputs have values in them first.
    const checkInputsAndRent = (e, slider) => {
        let profile = {}

        for (let key in miningOperations) {
            switch (key) {
                case 'targetMargin':
                    if (miningOperations[key] === '')
                        return setError({ targetMargin: true })
                    break;
                case 'profitReinvestment':
                    if (miningOperations[key] === '')
                        return setError({ profitReinvestment: true })
                    break;
                case 'updateUnsold':
                    if (miningOperations[key] === '')
                        return setError({ updateUnsold: true })
                    break;
                case 'autoRent':
                    if (slider === 'autoRent') {
                        // If neither radios are checked
                        if (miningOperations.spot === miningOperations.alwaysMineXPercent) {
                            return setError({ autoRent: true })
                        }
                        let options = { ...miningOperations, autoRent: !autoRent, autoTrade: false }
                        setOperations(options)
                    }
                    break;
                case 'autoTrade':
                    if (slider === 'autoTrade') {
                        // If neither radios are checked
                        if (miningOperations.morphie === miningOperations.supportedExchange) {
                            return setError({ autoTrade: true })
                        }
                        setOperations({ ...miningOperations, autoRent: false, autoTrade: !autoTrade })
                    }
            }
        }
    }


    const updateInputs = (e) => {
        const targetElem = e.target.id

        switch (targetElem) {
            case "targetMargin":
                if (err.targetMargin) setError({ targetMargin: false })
                props.dispatch(updateDailyBudget({ ...miningOperations, targetMargin: e.target.value }))
                setOperations({ ...miningOperations, targetMargin: e.target.value })
                break;
            case "profitReinvestment":
                if (err.profitReinvestment) setError({ profitReinvestment: false })
                props.dispatch(updateDailyBudget({ ...miningOperations, profitReinvestment: e.target.value }))
                setOperations({ ...miningOperations, profitReinvestment: e.target.value })
                break;
            case "updateUnsold":
                if (err.updateUnsold) setError({ updateUnsold: false })
                setOperations({ ...miningOperations, updateUnsold: e.target.value })
                break;
            case "autoRent":
                checkInputsAndRent(e, targetElem)
                break;
            case "spot":
                if (err.autoRent) setError({ autoRent: false })
                setOperations({ ...miningOperations, spot: true, alwaysMineXPercent: false })
                break;
            case "alwaysMineXPercent":
                if (err.autoRent) setError({ autoRent: false })
                setOperations({ ...miningOperations, alwaysMineXPercent: true, spot: false })
                break;
            case "autoTrade":
                checkInputsAndRent(e, targetElem)
                break;
            case "morphie":
                if (err.autoTrade) setError({ autoTrade: false })
                setOperations({ ...miningOperations, morphie: true, supportedExchange: false })
                break;
            case "supportedExchange":
                if (err.autoTrade) setError({ autoTrade: false })
                setOperations({ ...miningOperations, supportedExchange: true, morphie: false })
        }
    }


    const updatePercent = e => {
        let value = e.target.value
        props.dispatch(updateDailyBudget({ ...miningOperations, Xpercent: value }, 'upDateNiceHashMinimum'))
        setOperations({ ...miningOperations, Xpercent: value })
    }
    const showPercentInput = () => {
        let elem = document.getElementsByClassName('percent-input-container')[0]
        let pos = elem.style.transform
        if (pos === '') {
            elem.style.transform = 'translate(0px)'
        } else {
            elem.style = ''
        }
    }

    return (
        <>
            {showSettingaModal && <MarketsNPools handleClick={() => setShowSettingsModal(!showSettingaModal)} />}
            <div className="card mining-operation">
                <div className="card-header">
                    <div className="header-container">
                        <p>Mining Operations</p>
                        <div className="table-container message-field" style={{ height: miningOperations.message.length ? '134px' : '55px' }}>
                            <table className="table">
                                <thead id="mining-op-tableHeader">
                                    <tr>
                                        <th id="updateMessage" scope="col">Messages</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        miningOperations.message.map((message, i) => {
                                            return (
                                                <tr key={i} className="data-table-row">
                                                    <td>{i + 1}</td><td className="messages">{message}</td>
                                                </tr>
                                            )
                                        })
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    <div className="mining-operation-inputs">
                        <div className="target-margin-container">
                            <label htmlFor="basic-url">Target Margin</label>
                            <div className="input-group">
                                <input type="text" id="targetMargin" className="form-control" aria-label="Target margin reinvest"
                                    onChange={(e) => { updateInputs(e) }} maxLength="2" value={targetMargin} />
                                <div className="input-group-append">
                                    <span className="input-group-text">%</span>
                                </div>
                            </div>
                            <div style={{ transform: err.targetMargin ? 'scale(1)' : 'scale(0)' }} className="error-dialog">
                                <span className="error-arrow"></span>
                                <p>Input a percentage!</p>
                            </div>
                        </div>
                        <div className="profit-reinvestment-container">
                            <label htmlFor="basic-url">Profit Reinvestment</label>
                            <div className="input-group">
                                <input type="text" id="profitReinvestment" className="form-control" aria-label="Target margin reinvest"
                                    onChange={(e) => { updateInputs(e) }} maxLength="2" value={profitReinvestment} />
                                <div className="input-group-append">
                                    <span className="input-group-text">%</span>
                                </div>
                            </div>
                            <div style={{ transform: err.profitReinvestment ? 'scale(1)' : 'scale(0)' }} className="error-dialog">
                                <span className="error-arrow"></span>
                                <p>Input a percentage!</p>
                            </div>
                        </div>
                        <div className="unusoled-offers-container">
                            <label htmlFor="basic-url">Update Unsold Offers</label>
                            <div className="input-group">
                                <select className="custom-select" id="updateUnsold" onChange={(e) => { updateInputs(e) }}
                                    value={updateUnsold}>
                                    <option default>Hourly</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                </select>
                            </div>
                            <div style={{ transform: err.updateUnsold ? 'scale(1)' : 'scale(0)' }} className="error-dialog">
                                <span className="error-arrow"></span>
                                <p>Choose an interval!</p>
                            </div>
                        </div>
                        <div className="daily-budget-container">
                            <label htmlFor="basic-url">Daily Budget USD</label>
                            <div className="input-group">
                                <input type="text" className="form-control" id="dailyBudget" aria-label="Daily budget"
                                    onChange={(e) => { updateInputs(e) }} value={miningOperations.dailyBudget} />
                                <div className="input-group-append">
                                    <span className="daily-budget-text">Edit</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AUTO RENTING CONTAINER */}
                    <div className="automatic-renting-container">
                        <span className="renting-light-container">
                            <p>Mining</p>
                            {/* <svg viewBox="0 0 32 32" width="22" height="22">
                        <defs>
                            <radialGradient id="radial-gradient" cx="16" cy="16" r="16" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stopColor="#abff00"/>
                            <stop offset="0.12" stopColor="#a4fa00"/>
                            <stop offset="0.29" stopColor="#90ee00"/>
                            <stop offset="0.49" stopColor="#6fd900"/>
                            <stop offset="0.73" stopColor="#41bc00"/>
                            <stop offset="0.98" stopColor="#079700"/>
                            <stop offset="1" stopColor="#029400"/>
                        </radialGradient>
                        </defs>
                        <circle cx="16" cy="16" r="16" className={miningOperations.autoRent ? 'ledBulb' : 'hideLed'} fill=" url(#radial-gradient)"/>
                        <path d="M16,1A15,15,0,1,1,1,16,15,15,0,0,1,16,1m0-1A16,16,0,1,0,32,16,16,16,0,0,0,16,0Z" fill="#444"/>
                        </svg> */}
                            <svg viewBox="0 0 124 124" width="28" height="28">
                            <style type="text/css">
                                {
                            '.st0{fill:url(#SVGID_1_);}'+
                            '.st1{fill:url(#green-glow_1_);}'+
                            '.st2{fill:url(#SVGID_2_);}'
                            }
                            </style>
                            <g id="green-bulb">
                             <linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="61.3183" y1="38.26" x2="62.6683" y2="89.07" gradientTransform="matrix(1 0 0 -1 -4.134885e-03 125.9977)">
                              <stop  offset="0" stopColor="#79AA00"/>
                              <stop  offset="1" stopColor="#307F00"/>
                             </linearGradient>
                             <circle className="st0" cx="62" cy="62" r="31.3"/>
                             <radialGradient id="green-glow_1_" cx="62" cy="64" r="41.76" gradientTransform="matrix(1 0 0 -1 0 126)" gradientUnits="userSpaceOnUse">
                              <stop  offset="0" stopColor="#79AA00"/>
                              <stop  offset="0.12" stopColor="#72B000" stopOpacity="0.93"/>
                              <stop  offset="0.33" stopColor="#5FBE00" stopOpacity="0.76"/>
                              <stop  offset="0.6" stopColor="#41D600" stopOpacity="0.48"/>
                              <stop  offset="0.93" stopColor="#17F700" stopOpacity="9.000000e-02"/>
                              <stop  offset="1" stopColor="#0DFF00" stopOpacity="0"/>
                             </radialGradient>
                             <circle id="green-glow" className="st1" cx="62" cy="62" r="41.8"/>
                            </g>
                            <radialGradient id="SVGID_2_" cx="61.9954" cy="64.0035" r="31.3547" gradientTransform="matrix(1 0 0 -1 8.765546e-03 126.0075)" gradientUnits="userSpaceOnUse">
                             <stop  offset="0" stopColor="#FF8800"/>
                             <stop  offset="0.19" stopColor="#FF7A00" stopOpacity="0.83"/>
                             <stop  offset="0.62" stopColor="#FF5600" stopOpacity="0.39"/>
                             <stop  offset="1" stopColor="#FF3600" stopOpacity="0"/>
                            </radialGradient>
                            <circle className="st2" cx="62" cy="62" r="31.4"/>
                            </svg>
                        </span>
                        <ToggleSwitch
                            handleChange={(e) => { updateInputs(e) }}
                            id={"autoRent"}
                            htmlFor={"autoRent"}
                            isOn={autoRent} />

                        <div className="automatic-renting-content">
                            <h5>Automatic Renting</h5>
                            <div className="form-check">
                                <input className="form-check-input" type="radio" id="spot"
                                    value={spot}
                                    name="auto-rent"
                                    checked={miningOperations.spot ? true : false}
                                    onChange={(e) => {
                                        updateInputs(e)
                                    }} />
                                <label className="form-check-label" htmlFor="spotProfitable">
                                    Mine only when spot profitable
                            </label>
                            </div>
                            <div className="percent-container">
                                <PercentModal miningOperations={miningOperations} state={props}/>
                                <div className="form-check">
                                    <input className="form-check-input" type="radio" id="alwaysMineXPercent"
                                        value={alwaysMineXPercent}
                                        name="auto-rent"
                                        checked={miningOperations.alwaysMineXPercent ? true : false}
                                        onChange={(e) => { updateInputs(e) }} />
                                    <label className="form-check-label" htmlFor="alwaysMineXPercent">
                                        Always mine {Xpercent}% of the network
                                </label>
                                </div>
                                <div className="percent-input-container" >
                                    <input type="text" className="form-control percent-field" id="Xpercent"
                                        required placeholder="0" onChange={(e) => { updatePercent(e) }} maxLength="5"
                                        value={Xpercent}
                                    />
                                    <span>%</span>
                                    <button className="edit-percent-btn" onClick={showPercentInput}>edit</button>
                                </div>
                            </div>
                            <div style={{ transform: err.autoRent ? 'scale(1)' : 'scale(0)' }} className="error-dialog">
                                <span className="error-arrow"></span>
                                <p>Need at least one checked before renting!</p>
                            </div>
                            {/* Select Rental Markets & Mining Pool */}
                            <button onClick={() => setShowSettingsModal(!showSettingaModal)} className="select-markets-pools">Select Rental Markets & Mining Pools</button>

                            <br />
                            {/* AUTO TRADING */}
                            <h5>Automatic Trading</h5>
                            <div className="form-check">
                                <input className="form-check-input" type="radio" id="morphie"
                                    value={morphie}
                                    checked={miningOperations.morphie ? true : false}
                                    name="auto-trading"
                                    onChange={(e) => { updateInputs(e) }} />
                                <label className="form-check-label" htmlFor="morphie">
                                    Prefer the Morphie DEX
                            </label>
                            </div>
                            <div className="form-check">
                                <input className="form-check-input" type="radio" id="supportedExchange"
                                    // value={supportedExchange}
                                    name="auto-trading"
                                    checked={miningOperations.supportedExchange ? true : false}
                                    onChange={(e) => { updateInputs(e) }} />
                                <label className="form-check-label" htmlFor="supportedExchange">
                                    Supported exchanges
                            </label>
                            </div>
                            <div style={{ transform: err.autoTrade ? 'scale(1)' : 'scale(0)' }} className="error-dialog">
                                <span className="error-arrow"></span>
                                <p>Need at least one checked before renting!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const PercentModal = (props) => {
    
    let percent = props.miningOperations.Xpercent
    let token = props.miningOperations.token

    const modalOpen = () => {
        if(props.state.percentModal === 'open' && token !== 'RVN') {
            return {
                opacity: 1,
                transform: 'scale(1)'
            }
        } else {
            return {
                opacity: 0,
                transform: 'scale(0)'
            }
        }
    }

    return (
        <div className="percent-modal-container" style={modalOpen()}>
            <div className="percent-modal">
                <header className="percent-header"></header>
                <button type="button" className="close" data-dismiss="modal" aria-label="Close"
                onClick={()=> { props.state.dispatch(isNiceHashMinimum(0,0,'close'))} }>
                    <span aria-hidden="true" className="white-text">&times;</span>
                </button>
                <div className="content-wrapper">
                    <i className="fa fa-bell-o" aria-hidden="true"></i>
                    <p>Your <span>{percent}%</span> is too low for Nicehash's minimum, so MiningRigRentals will be used by default. 
                    If you would like to have Spartan also consider the Nicehash rental provider, please increase percentage.</p>
                </div>
                
                <div className="modal-footer flex-center">
                    <button className="btn btn-primary">CHANGE IT FOR ME
                    {/* <i className="far fa-gem ml-1 white-text"></i> */}
                    </button>
                    <button type="button" className="btn btn-outline-danger" data-dismiss="modal"
                    onClick={()=> { props.state.dispatch(isNiceHashMinimum(0,0,'close'))} }>OK, THANKS</button>
                </div>
            </div>
            <span className="error-arrow"></span>
        </div>
    )
}

const mapStateToProps = state => {
    return {
        percentModal: state.percentModalReducer.percentModalopen,
        user: state.auth.user,
        address: state.account.wallet,
        dailyBudget: state.miningOperationsReducer.dailyBudget
    };
};

export default connect(mapStateToProps)(MiningOperations);
