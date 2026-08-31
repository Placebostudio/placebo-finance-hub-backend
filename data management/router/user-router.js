const { Router } = require('express');
const { userController } = require("../controller/user-controller.js");

const userRouter = new Router();

userRouter.get('/', userController.getUsers);

userRouter.post('/login', userController.login);

userRouter.get('/:userid', userController.getUser);

userRouter.post('/', userController.addUser);

userRouter.put('/:userid', userController.updateUser);

userRouter.post('/:userid/accept', userController.acceptInvitation);

userRouter.post('/:userid/reactivate', userController.reactivateUser);

userRouter.delete('/:userid', userController.deleteUser);

module.exports = { userRouter };
