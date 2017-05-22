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

    if (this._state && this._state !== STATE.FULFILLED) {
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
    return function (value) {
        if (typeof callback !== 'function') {
            // 没有对调，状态和值保持不变
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

        // 这段可以不要其实，下面的 then.call 就有这个作用了，照着规范写的，就放着了
        if (x instanceof Promise) {
            x.then(value => resolve(promise, value), reason => reject(promise, reason))
            return
        }

        (function resolvePromise(x) { // 立即执行函数，为了再 then.call 里面递归调用
            // typeof null 的结果是 'object'，但这里 x 不能是 null
            if (x && typeof x === 'object' || typeof x === 'function') {
                let then
                try {
                    then = x.then
                } catch (e) {
                    reject(promise, e)
                    return
                }

                if (typeof then === 'function') {
                    let called = false  // then.call 的两个回调只能执行一次
                    try {
                        then.call(x, y => {
                            if (!called) {
                                resolvePromise(y)
                                called = true
                            }
                        }, r => {
                            if (!called) {
                                reject(promise, r)
                                called = true
                            }
                        })
                    } catch (e) {
                        // 已经改变了 promise 的状态的时候将忽略异常
                        !called && reject(promise, e)
                    }
                } else {
                    resolve(promise, x)
                }
            } else {
                resolve(promise, x)
            }
        })(x)
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

    // setTimeout(cb, 0) 模仿异步（浏览器上的 then 回调并不是这样，比 setTimeout(cb, 0) 要先执行）
    setTimeout(() => {
        callbacks.forEach(cb => cb(promise._value))
    }, 0)
    // 清空，每次调用 then 方法都会调用这个函数，不清空一个回调将会调用多次
    promise._fulfillReactions = []
    promise._rejectReactions = []
}


Promise.prototype.then = function (onFulfilled, onRejected) {
    if (this.constructor.class !== Promise.class) {
        throw TypeError('incorrent-subclassing')
    }
    let promise = new Promise(function () {})
    this._fulfillReactions.push(wrapCallBack(promise, onFulfilled, STATE.FULFILLED))
    this._rejectReactions.push(wrapCallBack(promise, onRejected, STATE.REJECTED))
    run(this)
    // 返回一个新的 promise，新的 promise 的状态由当前 promise 的回调改变
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
    let promise = new Promise(function () {})
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