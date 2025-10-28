import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';


@Injectable()
export class EmailService {
    constructor() { }

    async sendEmailVerification(email: string, otp: any): Promise<boolean> {

        // if (model && model.emailToken) {
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        let url = 'test.com'
        let mailOptions = {
            from: email,
            to: email, // list of receivers (separated by ,)
            subject: 'Your OTP Code',
            text: `Your OTP code is: ${otp}. It will expire in 5 minutes.`,
             html: `<h1>OTP Verification</h1>
               <p>Your OTP code is: <b>${otp}</b></p>
               <p>This code will expire in 5 minutes.</p>`,
        };


        var sent = await new Promise<boolean>(async function (resolve, reject) {
            return await transporter.sendMail(mailOptions, async (error, info) => {
                if (error) {
                    console.log('Message sent: %s', error);
                    return reject(false);
                }
                console.log('Message sent: %s', info.messageId);
                resolve(true);
            });
        })

        return sent;
    }
    //     else {
    //     throw new HttpException('REGISTER.USER_NOT_REGISTERED', HttpStatus.FORBIDDEN);
    // }



async verifyOtp(email: string, otp: any){
    console.log("the email", email,"the otp", otp)
}

}