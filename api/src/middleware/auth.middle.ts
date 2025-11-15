import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import * as db from '../database/queries.js';
import { Request, Response } from 'express';

const googleClient = new OAuth2Client(process.env.OAUTH_CLIENT_ID);

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

async function signUp(req: Request, res: Response) {
  try {
    // Validate required fields
    if (!req.body.email || !req.body.password) {
      return res.status(400).send('Email and password are required');
    }

    // Check if user already exists
    const existingUser = await db.getUserInfo(req.body.email);
    if (existingUser) {
      return res.status(409).send('User with this email already exists');
    }

    // Hash password and create user
    bcrypt.hash(req.body.password, 10, async function (err, hash) {
      if (err) {
        console.error(err, 'error');
        return res.status(500).send('Internal server error');
      }
      const response = await db.signUp({
        email: req.body.email,
        firstName: req.body.firstName || null,
        lastName: req.body.lastName || null,
        password: hash
      });
      if (response) {
        res.status(201).send('Successfully signed up user');
      } else {
        res.status(500).send('Failed to create user');
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).send('Internal server error');
  }
}

async function login(req: Request, res: Response) {
  const userInfo = await db.getUserInfo(req.body.email);
  if (!userInfo) {
    return res.status(401).send('Invalid email or password');
  }

  bcrypt.compare(req.body.password, userInfo.password, function (err, result) {
    if (err) {
      console.log(err, 'error');
      return res.status(400).send();
    }
    if (result) {
      jwt.sign(
        { userInfo },
        process.env.SECRET_KEY,
        { expiresIn: '100000s' },
        (err: any, token: any) => {
          if (err) {
            console.log(err);
            return res.status(400).send();
          }

          return res
            .status(200)
            .cookie('jwt', token, {
              sameSite: 'none',
              secure: true,
              path: '/',
              httpOnly: true,
              expires: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
              partitioned: false
            })
            .send('Authentication successful');
        }
      );
    } else {
      return res.status(401).send('Invalid email or password');
    }
  });
}

async function verify(req: Request, res: Response) {
  const token = req.cookies.jwt;
  if (!token) {
    console.log('Not logged in');
    return res.status(401).send('Authentication required');
  }

  jwt.verify(token, process.env.SECRET_KEY, (err: any, decoded: any) => {
    if (err) {
      console.log('Token verification error:', err);
      return res.status(401).send('Invalid or expired token');
    }
    console.log(decoded.userInfo);
    req.user = decoded.userInfo;
    res.status(200).json({ user: req.user });
  });
}

async function logOut(req: Request, res: Response) {
  res.clearCookie('jwt');
  res.status(200).send('Logged out');
}

async function googleAuth(req: Request, res: Response) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).send('Google credential is required');
    }

    // Verify the token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.OAUTH_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).send('Invalid Google token');
    }

    const { sub: googleId, email, given_name, family_name, picture } = payload;

    if (!email) {
      return res.status(400).send('Email not provided by Google');
    }

    // Find or create user
    let user = await db.getUserByGoogleId(googleId);

    if (!user) {
      // Check if email already exists (user signed up with email/password)
      const existingUser = await db.getUserInfo(email);

      if (existingUser && typeof existingUser === 'object') {
        // Link Google account to existing user
        user = await db.linkGoogleAccount(existingUser.id, googleId, picture);
      } else {
        // Create new user
        user = await db.createGoogleUser({
          email,
          googleId,
          firstName: given_name,
          lastName: family_name,
          profilePicture: picture,
          authProvider: 'google'
        });
      }
    }

    if (!user) {
      return res.status(500).send('Failed to create or update user');
    }

    // Create JWT and send cookie
    const token = jwt.sign(
      { userInfo: user },
      process.env.SECRET_KEY,
      { expiresIn: '7d' }
    );

    return res
      .status(200)
      .cookie('jwt', token, {
        sameSite: 'none',
        secure: true,
        path: '/',
        httpOnly: true,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        partitioned: false
      })
      .json({ user });

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).send('Authentication failed');
  }
}

export { signUp, login, verify, logOut, googleAuth };
