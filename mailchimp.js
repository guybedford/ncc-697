const superagent = require('superagent')
const querystring = require('querystring')
const { createHash } = require('crypto')

const md5 = (s) => {
  const md5 = createHash('md5')
  md5.update(s)
  return md5.digest('hex')
}

const config = {
  server: 'us2'
}

module.exports.addSubsriber = async (email, fName, lName) => {
  await addListMember('<rm>', {
    email_address: email,
    status: 'subscribed',
    update_existing: true,
    merge_fields: {
      FNAME: fName,
      LNAME: lName
    }
  }).catch((e) => {
    // console.log('e', e, typeof e)
    if (!(e && e.response && e.response.text && e.response.text.includes('Member Exists'))) {
      throw new Error(e)
    }
  })
}

module.exports.rmSubsriber = async (email) => {
  try {
    await deleteListMember('<rm>', md5(email))
  } catch (e) {
    console.log(e)
  }
}

const addListMember = async (listId, body, opts) => {
  opts = opts || {}
  const postBody = body

  const pathParams = { list_id: listId }
  const queryParams = { skip_merge_validation: opts.skipMergeValidation }
  const headerParams = {}
  const formParams = {}
  const authNames = ['bsicAuth']
  const contentTypes = ['application/json']
  const accepts = ['application/json', 'application/problem+json']
  const returnType = 'application/json'

  return await callApi(
    '/lists/{list_id}/members', 'POST',
    pathParams, queryParams, headerParams, formParams, postBody,
    authNames, contentTypes, accepts, returnType
  )
}

const deleteListMember = async (listId, subscriberHash) => {
  const postBody = null
  const pathParams = { list_id: listId, subscriber_hash: subscriberHash }
  const queryParams = {}
  const headerParams = {}
  const formParams = {}
  const authNames = ['basicAuth']
  const contentTypes = ['application/json']
  const accepts = ['application/json', 'application/problem+json']
  const returnType = 'application/json'

  return await callApi(
    '/lists/{list_id}/members/{subscriber_hash}', 'DELETE',
    pathParams, queryParams, headerParams, formParams, postBody,
    authNames, contentTypes, accepts, returnType
  )
}
const paramToString = function (param) {
  if (param === undefined || param == null) return ''
  if (param instanceof Date) return param.toJSON()
  return param.toString()
}

const buildUrl = function (path, pathParams) {
  const basePath = 'https://server.api.mailchimp.com/3.0'.replace(/\/+$/, '')

  if (!path.match(/^\//)) {
    path = '/' + path
  }
  let url = basePath + path
  url = url.replace(/\{([\w-]+)\}/g, function (fullMatch, key) {
    let value
    // eslint-disable-next-line
    if (pathParams.hasOwnProperty(key)) {
      value = paramToString(pathParams[key])
    } else {
      value = fullMatch
    }
    return encodeURIComponent(value)
  })

  // Define the server
  if (typeof config.server !== 'undefined') {
    url = url.replace('server', config.server)
  }

  return url
}

const normalizeParams = function (params) {
  const newParams = {}
  for (const key in params) {
    // eslint-disable-next-line
    if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null) {
      const value = params[key]
      if (isFileParam(value) || Array.isArray(value)) {
        newParams[key] = value
      } else {
        newParams[key] = paramToString(value)
      }
    }
  }
  return newParams
}
const isJsonMime = function (contentType) {
  return Boolean(contentType != null && contentType.match(/^application\/json(;.*)?$/i))
}

const jsonPreferredMime = function (contentTypes) {
  for (let i = 0; i < contentTypes.length; i++) {
    if (isJsonMime(contentTypes[i])) {
      return contentTypes[i]
    }
  }
  return contentTypes[0]
}

const callApi = function callApi (path, httpMethod, pathParams, queryParams, headerParams, formParams, bodyParam, authNames, contentTypes, accepts, returnType) {
  const url = buildUrl(path, pathParams)
  const request = superagent(httpMethod, url)
  const cache = true
  const timeout = 120000

  // Basic Authentication
  if (config.apiKey !== undefined && config.apiKey !== '') {
    request.auth('user', config.apiKey)
  } else if (config.accessToken !== undefined && config.accessToken !== '') {
    request.set({ Authorization: 'Bearer ' + config.accessToken })
  }

  // set query parameters
  if (httpMethod.toUpperCase() === 'GET' && cache === false) {
    // eslint-disable-next-line
    queryParams['_'] = new Date().getTime()
  }
  request.query(normalizeParams(queryParams))
  request.set({}).set(normalizeParams(headerParams))
  request.timeout(timeout)

  const contentType = jsonPreferredMime(contentTypes)
  if (contentType) {
    // Issue with superagent and multipart/form-data (https://github.com/visionmedia/superagent/issues/746)
    if (contentType !== 'multipart/form-data') {
      request.type(contentType)
    }
  } else {
    request.type('application/json')
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    request.send(querystring.stringify(normalizeParams(formParams)))
  } else if (contentType === 'multipart/form-data') {
    const _formParams = normalizeParams(formParams)
    for (const key in _formParams) {
      // eslint-disable-next-line
      if (_formParams.hasOwnProperty(key)) {
        if (isFileParam(_formParams[key])) {
          // file field
          request.attach(key, _formParams[key])
        } else {
          request.field(key, _formParams[key])
        }
      }
    }
  } else if (bodyParam) {
    request.send(bodyParam)
  }

  const accept = jsonPreferredMime(accepts)
  if (accept) {
    request.accept(accept)
  }

  if (returnType === 'Blob') {
    request.responseType('blob')
  } else if (returnType === 'String') {
    request.responseType('string')
  }

  return new Promise(function (resolve, reject) {
    request.end(function (error, response) {
      if (error) {
        reject(error)
      } else {
        try {
          const data = deserialize(response, returnType)
          resolve({ data: data, response: response })
        } catch (err) {
          reject(err)
        }
      }
    })
  })
}

const isFileParam = function (param) {
  // fs.ReadStream in Node.js and Electron (but not in runtime like browserify)
  if (typeof require === 'function') {
    let fs
    try {
      fs = require('fs')
    } catch (err) {}
    if (fs && fs.ReadStream && param instanceof fs.ReadStream) {
      return true
    }
  }
  // Buffer in Node.js
  if (typeof Buffer === 'function' && param instanceof Buffer) {
    return true
  }
  // Blob in browser
  // eslint-disable-next-line
  if (typeof Blob === 'function' && param instanceof Blob) {
    return true
  }
  // File in browser (it seems File object is also instance of Blob, but keep this for safe)
  // eslint-disable-next-line
  if (typeof File === 'function' && param instanceof File) {
    return true
  }
  return false
}

const deserialize = function deserialize (response, returnType) {
  if (response === null || returnType === null || response.status === 204) {
    return null
  }
  // Rely on SuperAgent for parsing response body.
  // See http://visionmedia.github.io/superagent/#parsing-response-bodies
  let data = response.body
  if (data == null || (typeof data === 'object' && typeof data.length === 'undefined' && !Object.keys(data).length)) {
    // SuperAgent does not always produce a body; use the unparsed response as a fallback
    data = response.text
  }
  return convertToType(data, returnType)
}

const convertToType = function (data, type) {
  if (data === null || data === undefined) return data

  switch (type) {
    case 'Boolean':
      return Boolean(data)
    case 'Integer':
      return parseInt(data, 10)
    case 'Number':
      return parseFloat(data)
    case 'String':
      return String(data)
    case 'Date':
      return parseDate(String(data))
    case 'Blob':
      return data
    default:
      if (type === Object) {
        // generic object, return directly
        return data
      } else if (typeof type === 'function') {
        // for model type like: User
        return type.constructFromObject(data)
      } else if (Array.isArray(type)) {
        // for array type like: ['String']
        const itemType = type[0]
        return data.map(function (item) {
          return exports.convertToType(item, itemType)
        })
      } else if (typeof type === 'object') {
        // for plain object type like: {'String': 'Integer'}
        let keyType
        let valueType
        for (const ks in type) {
          // eslint-disable-next-line
          if (type.hasOwnProperty(ks)) {
            keyType = ks
            valueType = type[ks]
            break
          }
        }
        const result = {}
        for (const k in data) {
          // eslint-disable-next-line
          if (data.hasOwnProperty(k)) {
            const key = convertToType(k, keyType)
            const value = convertToType(data[k], valueType)
            result[key] = value
          }
        }
        return result
      } else {
        // for unknown type, return the data directly
        return data
      }
  }
}

const parseDate = function (str) {
  return new Date(str.replace(/T/i, ' '))
}
