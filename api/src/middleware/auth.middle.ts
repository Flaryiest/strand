import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import * as db from '../database/queries.js';
import { Request, Response } from 'express';

const googleClient = new OAuth2Client(
  process.env.OAUTH_CLIENT_ID,
  process.env.OAUTH_CLIENT_SECRET,
  process.env.OAUTH_REDIRECT_URI
);

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

async function updateLocation(req: Request, res: Response) {
  try {
    const token = req.cookies.jwt;
    if (!token) {
      return res.status(401).send('Authentication required');
    }

    jwt.verify(token, process.env.SECRET_KEY, async (err: any, decoded: any) => {
      if (err) {
        return res.status(401).send('Invalid or expired token');
      }

      const { location } = req.body;
      if (!location || typeof location !== 'string') {
        return res.status(400).send('Location is required');
      }

      const userId = decoded.userInfo.id;
      const result = await db.updateUserLocation(userId, location);

      if (result) {
        res.status(200).json({ message: 'Location updated successfully' });
      } else {
        res.status(500).send('Failed to update location');
      }
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).send('Internal server error');
  }
}

async function googleAuth(req: Request, res: Response) {
  try {
    const { credential, code } = req.body;

    let payload;

    if (code) {
      // Handle authorization code flow (standard OAuth popup)
      const { tokens } = await googleClient.getToken({
        code,
        redirect_uri:
          req.body.redirect_uri ||
          `${req.protocol}://${req.get('host')}/auth/google/callback`
      });

      if (!tokens.id_token) {
        return res.status(400).send('No ID token received from Google');
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.OAUTH_CLIENT_ID
      });

      payload = ticket.getPayload();
    } else if (credential) {
      // Handle One Tap flow (backward compatibility)
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.OAUTH_CLIENT_ID
      });

      payload = ticket.getPayload();
    } else {
      return res.status(400).send('Google credential or code is required');
    }

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
    const token = jwt.sign({ userInfo: user }, process.env.SECRET_KEY, {
      expiresIn: '7d'
    });

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

async function requireAuth(req: Request, res: Response, next: any) {
  try {
    const token = req.cookies.jwt;
    console.log('Auth middleware - token present:', !!token);
    console.log('Auth middleware - all cookies:', req.cookies);
    
    if (!token) {
      console.log('Auth middleware - No JWT token found');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required - no token found' 
      });
    }

    jwt.verify(token, process.env.SECRET_KEY, (err: any, decoded: any) => {
      if (err) {
        console.log('Auth middleware - JWT verification failed:', err.message);
        return res.status(401).json({ 
          success: false,
          error: 'Invalid or expired token' 
        });
      }
      console.log('Auth middleware - User authenticated:', decoded.userInfo.id);
      req.user = decoded.userInfo;
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Authentication failed' 
    });
  }
}

export { signUp, login, verify, logOut, googleAuth, updateLocation, requireAuth };
