import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from './db.js';
import { users } from '../schema/index.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

export function configurePassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google'), null);

          // Check if user already exists by googleId
          let [user] = await db
            .select()
            .from(users)
            .where(eq(users.googleId, profile.id));

          if (!user) {
            // Check by email (user might have registered with email before)
            [user] = await db
              .select()
              .from(users)
              .where(eq(users.email, email));

            if (user) {
              // Link Google account to existing email account
              await db
                .update(users)
                .set({ googleId: profile.id, avatar: profile.photos?.[0]?.value })
                .where(eq(users.id, user.id));
            } else {
              // Create new user
              [user] = await db
                .insert(users)
                .values({
                  email,
                  name:     profile.displayName,
                  avatar:   profile.photos?.[0]?.value,
                  googleId: profile.id,
                  provider: 'google',
                })
                .returning();
            }
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

export default configurePassport;
