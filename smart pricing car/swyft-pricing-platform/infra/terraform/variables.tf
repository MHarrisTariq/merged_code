variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "swyft-pricing"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.3.0/24", "10.0.4.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "db_username" {
  type        = string
  description = "RDS master username"
  default     = "swyftadmin"
}

variable "db_password" {
  type        = string
  description = "RDS master password — pass via TF_VAR_db_password or secrets manager"
  sensitive   = true
}
