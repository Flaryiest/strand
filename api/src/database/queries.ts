import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

async function signUp(data: Prisma.UserCreateInput) {
  try {
    return await prisma.user.create({ data });
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function getUserInfo(email: string) {
  try {
    return await prisma.user.findUnique({
      where: { email }
    });
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function getUserByGoogleId(googleId: string) {
  try {
    return await prisma.user.findUnique({
      where: { googleId }
    });
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function createGoogleUser(data: {
  email: string;
  googleId: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  authProvider: string;
}) {
  try {
    return await prisma.user.create({
      data: {
        ...data,
        password: null,
      }
    });
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function linkGoogleAccount(userId: number, googleId: string, profilePicture?: string) {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        profilePicture,
        authProvider: 'google'
      }
    });
  } catch (err) {
    console.log(err);
    return false;
  }
}

export { signUp, getUserInfo, getUserByGoogleId, createGoogleUser, linkGoogleAccount };
