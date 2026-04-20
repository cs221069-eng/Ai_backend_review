import jwt from 'jsonwebtoken';

const generateToken = (user,res) =>{
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
    }

    const token = jwt.sign(
        {
            id: user._id,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.cookie("token" , token ,{
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
    });

    return token;
}

export default generateToken;
