import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class AddUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  uuid!: string;
}

export class GenerateLinkDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsString()
  @IsNotEmpty()
  port!: number;
}
