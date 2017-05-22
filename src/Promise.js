const STATE = {
    PENDING: 'pending',
    FULFILLED: 'fulfilled',
    REJECTED: 'rejected',
}

function resolve(promise, value) {
    if (promise._state !== STATE.PENDING) return
    promise._value = value
    promise._state = STATE.FULFILLED
    run(promise)
}


function reject(promise, reason) {
    if (promise._state !== STATE.PENDING) return
    promise._value = reason
    promise._state = STATE.REJECTED
    run(promise)    
}


function Promise(executor) {
    if (typeof executor !== 'function') {
        throw TypeError(`Promise resolver ${executor} is not a function`)
    }

    if (!(this instanceof Promise)) {
        throw TypeError(`${this.toString()} is not a Promise`)
    }

    if (this._state  && this._state !== STATE.FULFILLED) {
        throw TypeError(`promise is unresolved`)
    }

    if (this._state && this._state === STATE.FULFILLED) {
        throw TypeError(`promise is resolved`)
    }

    this._state = STATE.PENDING
    this._fulfillReactions = []
    this._rejectReactions = []
    try {
        let promise = this
        executor(value => resolve(promise, value), reason => reject(promise, reason))
    } catch (e) {
        return Promise.reject(e)
    }
    return this
}

function wrapCallBack(promise, callback, state) {
    return function(value) {
        if (typeof callback !== 'function') {
            if (state === STATE.REJECTED) {
                reject(promise, value)
            } else {
                resolve(promise, value)
            }
            return
        }
        let x
        try {
            x = callback(value)
        } catch (e) {
            reject(promise, e)
            return
        }

        if (x === promise) {
            reject(promise, new TypeError('x and promise refer to the same object'))
            return
        }

        if (x instanceof Promise) {
            x.then(value => resolve(promise, value), reason => reject(promise, reason))
            return
        }

        (function resolvePromise(promise, x) {

            if (x && typeof x === 'object' || typeof x === 'function') {
                let then
                try {
                    then = x.then
                } catch (e) {
                    reject(promise, e)
                    return
                }

                if (typeof then === 'function') {
                    let called = false
                    try {
                        then.call(x, y => {
                            if (!called) {
                                resolvePromise(promise, y)
                                called = true
                            }
                        }, r => {
                            if (!called) {
                                reject(promise, r)
                                called = true
                            }
                        })
                    } catch (e) {
                        !called && reject(promise, e)
                    }
                } else {
                    resolve(promise, x)
                }
            } else {
                resolve(promise, x)
            }
        })(promise, x)
    }
}

function run(promise) {
    if (promise._state === STATE.PENDING) return
    let callbacks
    if (promise._state === STATE.FULFILLED) {
       callbacks = promise._fulfillReactions 
    } else {
        callbacks = promise._rejectReactions
    }
    setTimeout(() => {
        callbacks.forEach(cb => cb(promise._value))
    }, 0)
    promise._fulfillReactions = []
    promise._rejectReactions = []
}


Promise.prototype.then = function (onFulfilled, onRejected) {
    if (this.constructor.class !== Promise.class) {
        throw TypeError('incorrent-subclassing')
    }
    let promise = new Promise(function(){})
    this._fulfillReactions.push(wrapCallBack(promise, onFulfilled, STATE.FULFILLED))
    this._rejectReactions.push(wrapCallBack(promise, onRejected, STATE.REJECTED))
    run(this)
    return promise
}

Promise.prototype.catch = function (reject) {
    return this.then(undefined, reject)
}

Promise.all = function (iterable) {
    if (this.class !== Promise.class) {
        throw TypeError('incorrent-subclassing')
    }
    if (!(typeof this === 'function')) {
        throw TypeError(`this is not a constructor`)
    }
    if (iterable.length === undefined) {
        return Promise.reject(new TypeError('argument is not iterable'))
    }
    if (iterable.length == 0) {
        return Promise.resolve([])
    }

    return new Promise((resolve, reject) => {
        let results = []
        iterable.forEach(p => {
            Promise.resolve(p).then((value) => {
                results.push(value)
                if (results.length === iterable.length) {
                    resolve(results)
                }
            }).catch(reason => reject(reason))
        })
    })
}

Promise.resolve = function (data) {
    if (this.class !== Promise.class) {
        throw TypeError('incorrent-subclassing')
    }
    if (typeof this !== 'function') {
        throw TypeError('this is not a constructor')
    }
    if (data instanceof Promise) {
        return data
    }

    return new Promise(resolve => resolve(data))
}

Promise.reject = function (reason) {
    if (typeof this !== 'function') {
        throw TypeError('this is not a constructor')
    }
    if (this.class !== Promise.class) {
        throw TypeError('incorrent-subclassing')
    }
    let promise = new Promise(function (){})
    reject(promise, reason)
    return promise
}

Promise.race = function (iterable) {
    if (this.class !== Promise.class) {
        throw TypeError('incorrent-subclassing')
    }
    if (!(typeof this === 'function')) {
        throw TypeError(`this is not a constructor`)
    }
    if (iterable.length === undefined) {
        return Promise.reject(new TypeError('argument is not iterable'))
    }
    if (iterable.length == 0) {
        return new Promise(function () {})
    }

    return new Promise((resolve, reject) => {
        iterable.forEach(p => {
            p.then(resolve, reject)
        })
    })
}

Promise.class = 'Promise'
module.exports = Promise