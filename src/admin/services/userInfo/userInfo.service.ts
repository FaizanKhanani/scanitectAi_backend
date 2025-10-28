import { Injectable } from '@nestjs/common';
import { InjectModel } from "@nestjs/mongoose";
import { User } from "../../../users/schemas/user.schema";
import { Model, Types } from "mongoose";

@Injectable()
export class UserInfoService {
constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) { }



    async getUser(){
      console.log("in get user ")

     const getUser = await this.userModel.find().exec();

     if(getUser){

        console.log("successfully fetch all users ")
        //   return getUser
           return { success: true , date: getUser };
     }

      return { success: false, message: 'error occur while fetching users' };


    }





 async updateUser(id: string, updateData: Partial<User>) {


    console.log("the id", id, "the data", updateData)
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }, // return updated document
    ).exec();

    if (!user) {
       return { success: false, message: 'user is not found of this data' };
    }

    return { success: true , data: user }
  }
}
