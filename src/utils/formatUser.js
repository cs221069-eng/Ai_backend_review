export const formatUser = (user) => {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
};