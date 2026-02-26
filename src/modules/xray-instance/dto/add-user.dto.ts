import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class AddUserDto {
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @IsString()
  @IsNotEmpty()
  uuid!: string;
}

export class GenerateLinkDto {
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsInt()
  @IsNotEmpty()
  port!: number;
}
