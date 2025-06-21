import express from 'express';
import handleGetFileComments from './getComments';

const commentsRouter = express.Router();

commentsRouter.get('/getComments', handleGetFileComments);

export default commentsRouter; 