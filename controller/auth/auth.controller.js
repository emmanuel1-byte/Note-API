const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config()
const entry = require('../../middleware/invalidateTokens')
const Model = require('../../model/index')
const User = Model.user
const authConfig = require('../../config/index')

// Base Route
const main = (req, res) => {
  res.status(200).json({ message: 'NOTE API is running' })
}

// create User account that meets all criterias
const signup = async (req, res, next) => {
  const { username, email, password } = req.body
  const salt = crypto.randomBytes(16)
  crypto.pbkdf2(
    password,
    salt,
    310000,
    32,
    'sha256',
    async (err, hashPassword) => {
      if (err) {
        return next(err)
      }

      try {
        await User.create({ username, email, password: hashPassword, salt })
        return res
          .status(201)
          .json({ sucess: true, message: 'User signUp was succesfull' })
      } catch (err) {
        console.error('User signUp not succesfull ', err)
        return res
          .status(500)
          .json({ sucess: false, message: 'User signup failed' })
      }
    }
  )
}

// User Login
const login = async (req, res, next) => {
  const { username, password } = req.body

  try {
    const User_ = await User.findOne({ where: { username } })
    if (!User_) {
      return res.status(404).json({
        success: false,
        accessToken: null,
        message: 'incorrect username or password'
      })
    }
    crypto.pbkdf2(
      password,
      User_.salt,
      310000,
      32,
      'sha256',
      async (err, hashPassword) => {
        if (err) {
          return next(err)
        }
        if (!crypto.timingSafeEqual(User_.password, hashPassword)) {
          return res.status(404).json({
            success: false,
            accessToken: null,
            message: 'incorrect username or password'
          })
        }

        const token = jwt.sign({ id: User_.user_id }, process.env.JWT_SECRET, {
          algorithm: 'HS256',
          expiresIn: '1h'
        })
        const refreshToken_ = await Model.createRefreshToken(User_)
        return res.status(200).json({
          success: true,
          user: {
            id: User_.user_id,
            email: User_.email,
            username: User_.username
          },
          accessToken: token,
          refreshToken: refreshToken_
        })
      }
    )
  } catch (err) {
    console.error(err)
    return res
    .status(500)
    .json({ sucess: false, message: 'User login failed' })
  }
}

// verify RefreshToken
const refreshAndVerifyToken = async (req, res) => {
  const { refreshToken: requestToken } = req.body // destructured refreshToken property from req.body and renamed it to requestToken
  if (!requestToken) {
    return res
      .status(401)
      .json({ success: false, message: 'Refresh token is required' })
  }

  try {
    const refreshToken = await Model.RefreshToken.findOne({
      where: { token: requestToken }
    })
    if (!refreshToken) {
      return res
        .status(200)
        .json({ success: false, message: 'Request Token is not in database' })
    }
    if (Model.verify(refreshToken)) {
      await Model.RefreshToken.destroy({ where: { id: refreshToken.id } })
      return res.status(200).json({
        success: false,
        message: 'Request Token has Expired please make a new signin Request'
      })
    }
    const user = refreshToken
    const newAccessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h'
    })
    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: refreshToken.token
    })
  } catch (err) {
    console.error('Error .................... ', err)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

// User Logout
const logout = async (req, res) => {
  const accessToken =  req.headers.authorization
  const { refreshToken } = req.body
  if (!refreshAndVerifyToken || !accessToken) {
    return res.status(400).json({
      success: false,
      message: 'tokens missing please provide tokens'
    })
  }

  try {
    await Model.RefreshToken.destroy({ where: { token: refreshToken } })
    entry.invalidateToken(accessToken)
    return res
      .status(200)
      .json({ success: true, message: 'user logged out succesfully' })
  } catch (err) {
    console.error('Error Invalidating token.................... ', err.stack)
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' })
  }
}

// forget Password
const forgotPassword = async (req, res) => {
  const { email } = req.body
  const userEmail = await User.findOne({ where: { email } })
  if (!userEmail) {
    return res.status(404).json({ success: false, message: 'Email not found' })
  }
  const token = uuidv4() // generate reset password token
  const tokenExpiration = Date.now() + 3600000 // 1 hour
  await resetToken.create({ email, token, tokenexpiration: tokenExpiration })
  authConfig.passwordReset(email, token)
  return res.status(200).json({ success: true, message: 'Email sent' })
}

// Reset Password
const resetPassword = async (req, res) => {
  const { resetToken } = req.params
  const { password } = req.body
  const checkTokenExistence = Model.resetToken.findOne({
    where: { token: resetToken }
  })
  if (
    !checkTokenExistence ||
    checkTokenExistence.tokenexpiration < Date.now()
  ) {
    return res
      .status(404)
      .json({ success: false, message: 'invalid or expired token ' })
  }
  const salt = crypto.randomBytes(16)
  crypto.pbkdf2(
    password,
    salt,
    310000,
    32,
    'sha256',
    async (err, hashPassword) => {
      if (err) {
        return next(err)
      }
      const updateUserPassword = await User.update(
        { password: hashPassword, salt },
        { where: { email: checkTokenExistence.email } }
      )
      if (!updateUserPassword) {
        return res.json({
          success: false,
          message: 'password reset unsuccesfull something went wrong'
        })
      }
      return res
        .status(200)
        .json({ success: true, message: 'password reset succesfull' })
    }
  )
}

module.exports = {
  main,
  signup,
  login,
  logout,
  refreshAndVerifyToken,
  forgotPassword,
  resetPassword
}
