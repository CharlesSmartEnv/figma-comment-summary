import express from 'express';
import handleGetFileComments from './getComments';

const commentsRouter = express.Router();

// UI calls POST /api/comments/getComments with JSON body
commentsRouter.post('/getComments', handleGetFileComments);

export default commentsRouter; 