import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Returns the currently authenticated user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async me(@CurrentUser() user: JwtUser) {
    const found = await this.usersService.findById(user.id);
    if (!found) throw new NotFoundException('User not found');
    return found;
  }
}
