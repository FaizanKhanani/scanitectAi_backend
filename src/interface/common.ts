import { Types } from 'mongoose';
export interface responseData {
    statusCode: Number;
    timestamp: String;
    path?: String;
    data?: [] | null;
    message: String,
    isSuccess: Boolean,
    error: string | null | []

}

export interface userData {
  [key: string]: any;

}
export interface UserRequest extends Request {
    user: any
}


