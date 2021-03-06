create database if not exists mrqd default character set utf8;

use mrqd;

drop table if exists users;
create table if not exists users (id int not null auto_increment,
                    name varchar(64) not null,
                    phone varchar(20),
                    email varchar(254), -- should <256, or fail as a key
                    password varchar(32),
                    create_time timestamp default current_timestamp,
                    primary key (id),
                    unique (email),
                    unique (phone));

insert into users(id, name) values(-1, '签到君');


drop table if exists versions;
create table if not exists versions (uid int not null,
                       version int not null,
                       primary key (uid));

insert into versions values(-1,0);

-- flag:0   1 this habbit is enabled, 0 disabled

-- flag:1   1 Monday is work day, 0 Monday is rest day
-- flag:2   1 Tuesday is work day, 0 Tuesday is rest day
-- flag:3   1 Wednesday is work day, 0 Wednesday is rest day
-- flag:4   1 Thursday is work day, 0 Thursday is rest day
-- flag:5   1 Friday is work day, 0 Friday is rest day
-- flag:6   1 Saturday is work day, 0 Saturday is rest day
-- flag:7   1 Sunday is work day, 0 Sunday is rest day
-- flag:[8-63]   reserved, all 0
drop table if exists habits;
create table if not exists habits (id bigint not null auto_increment,
                     uid int not null,
                     name varchar(255) not null,
                     flag bigint unsigned not null,
                     create_time timestamp default current_timestamp,
                     primary key (id),
                     unique key (uid, name));

insert into habits(id, uid, name, flag)
     values (-1, -1, '每天跑步5公里',    1|1<<1|1<<2|1<<3|1<<4|1<<5),
            (-2, -1, '晚上11点前睡觉',   1|1<<1|1<<2|1<<3|1<<4|1<<5|1<<7),
            (-3, -1, '每天阅读半小时',   1|1<<1|1<<2|1<<3|1<<4|1<<5|1<<6),
            (-4, -1, '每周六陪父母聊天', 0|1<<6),
            (-5, -1, '不可能完成的挑战', 0|1<<1|1<<2|1<<3|1<<4|1<<5|1<<6|1<<7),
            (-6, -1, '找20个老婆',       0|1<<1|1<<2|1<<4|1<<5|1<<6|1<<7),
            (-7, -1, '竞选美国总统',     0|1<<1|1<<2|1<<3|1<<4|1<<5|1<<6|1<<7),
            (-8, -1, '重写一个操作系统', 0|1<<1|1<<3|1<<4|1<<5|1<<6|1<<7),
            (-9, -1, '让计算机比现在快1亿倍', 0|1<<1|1<<3|1<<4|1<<5|1<<6|1<<7);


drop table if exists checkins;
create table if not exists checkins (hid bigint not null,
                 year int not null,
                 uid int not null,
                 m1 int unsigned not null default 0,
                 m2 int unsigned not null default 0,
                 m3 int unsigned not null default 0,
                 m4 int unsigned not null default 0,
                 m5 int unsigned not null default 0,
                 m6 int unsigned not null default 0,
                 m7 int unsigned not null default 0,
                 m8 int unsigned not null default 0,
                 m9 int unsigned not null default 0,
                 m10 int unsigned not null default 0,
                 m11 int unsigned not null default 0,
                 m12 int unsigned not null default 0,
                 primary key(hid, year));
