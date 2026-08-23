const { Router } = require('express');
const { userController } = require("../controller/user-controller.js");

const userRouter = new Router();

userRouter.get('/', userController.getUsers);
userRouter.get('/:userid', userController.getUser);
userRouter.post('/', userController.addUser);
userRouter.post('/login', userController.login);

userRouter.put('/:userid', userController.updateUser);
userRouter.delete('/:userid', userController.deleteUser);

module.exports = { userRouter };
