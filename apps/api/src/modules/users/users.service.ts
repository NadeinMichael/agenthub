import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOneBy({ email });
  }

  findById(id: string): Promise<Omit<UserEntity, 'passwordHash'> | null> {
    return this.userRepo.findOne({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  create(data: { email: string; passwordHash: string; name: string }): Promise<UserEntity> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }
}
