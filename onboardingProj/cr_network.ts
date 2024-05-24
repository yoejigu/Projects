"use strict";

import * as aws from "@pulumi/aws"
import * as pulumi from "@pulumi/pulumi"

/*
    - 2 private subnets in diffrent avalability zones for EKS
        - >= 6 ip addresses, but prefer 16+ 
    - VPC must have DNS hostname and DNS resolution
    - Nat gateway
    - 1 public subnet for load balancer
        - needs a tag of kubernetes.io/role/elb:1

*/
export interface vpcComponentsArgs{

}

export class NetworkComponent extends pulumi.ComponentResource {
    public readonly vpcId: pulumi.Output<string>;
    public readonly subnet1Id: pulumi.Output<string>;
    public readonly subnet2Id: pulumi.Output<string>;
    public readonly subnet3Id: pulumi.Output<string>;

    constructor(netname : string, args?:{}, opts?: pulumi.ComponentResourceOptions ){

        super("yte:networkcr:NetworkComponent", netname);
        
        const prefix = "yte";
        const vpc = new aws.ec2.Vpc("eks-vpc", {
            cidrBlock: "10.0.0.0/24",
            enableDnsHostnames: true,
            tags:{
                Name: prefix + "-eks-vpc",
            },
           
        },{parent: this});
        
        //Create Subnet-1
        const subnet1 = new aws.ec2.Subnet("eks-private-subnet-1", {
            vpcId : vpc.id,
            cidrBlock: "10.0.0.0/25",
            availabilityZone: "us-east-1a",
            tags:{
                Name: prefix + "-eks-private-subnet-1",
            },

        },
        {
            parent: this,
            dependsOn: [vpc],

        });
        
        //Create Subnet-2
        const subnet2 = new aws.ec2.Subnet("eks-private-subnet-2", {
            vpcId : vpc.id,
            cidrBlock: "10.0.0.128/26",
            availabilityZone: "us-east-1b",
            tags:{
                Name: prefix + "-eks-private-subnet-2",
            },


        },
        {
            parent: this,
            dependsOn: [vpc],
        });

        //Create subnet 3
        const subnet3 = new aws.ec2.Subnet("eks-public-subnet-3", {
            vpcId : vpc.id,
            cidrBlock: "10.0.0.192/26",
            availabilityZone: "us-east-1b",
            tags:{
                Name: prefix + "-eks-public-subnet-3",
                "kubernetes.io/role/elb" : "1",
            },

        },
        {
            parent: this,
            dependsOn: [vpc],
        });
        
        //create internet gateway
        const gw = new aws.ec2.InternetGateway("eks-igw",{
            vpcId: vpc.id,
            tags:{
                Name: prefix + "-eks-igw",
            },
            
        },
        {
            parent: this,
            dependsOn: [vpc],
        });

        const natGwEip = new aws.ec2.Eip("natGwEip", {
            domain: "vpc",
            tags:{
                Name: prefix + "-eks-natEip",
            },
        });
        
        const natGw = new aws.ec2.NatGateway("eksNatGw",{
            allocationId: natGwEip.id,
            subnetId: subnet3.id,
            connectivityType: "public",
            tags: {
                Name: prefix + "eks-natGw",
            }

        },{dependsOn:[subnet3, natGwEip]});

        const pubRTable = new aws.ec2.RouteTable("eks-pub-rt", {
            vpcId: vpc.id,
            routes:[
                {
                    cidrBlock: "0.0.0.0/0",
                    gatewayId: gw.id,
                }
            ],
            tags:{
                Name: prefix + "-eks-pubRt",
            },
        },
        {
            parent: this,
            dependsOn: [vpc, gw],
        });

        const pubRtAssociation = new aws.ec2.RouteTableAssociation("igw-rt", {
            routeTableId: pubRTable.id,
            subnetId: subnet3.id,
            
        },
        {
            parent: this,
            dependsOn: [pubRTable, subnet3]
        });

        const privRTable = new aws.ec2.RouteTable("eks-priv-rt",{
            vpcId: vpc.id,
            routes:[
                {
                    cidrBlock: "0.0.0.0/0",
                    natGatewayId: natGw.id,
                }
            ],
            tags:{
                Name: prefix + "-eks-privRt",
            }
        }, {dependsOn:[natGw, vpc]});

        const privRtAssociation1 = new aws.ec2.RouteTableAssociation("privNg-rt1", {
            routeTableId: privRTable.id,
            subnetId: subnet1.id,
            
        },
        {
            parent: this,
            dependsOn: [privRTable, subnet1]
        });

        const privRtAssociation2 = new aws.ec2.RouteTableAssociation("privNg-rt2", {
            routeTableId: privRTable.id,
            subnetId: subnet2.id,
            
        },
        {
            parent: this,
            dependsOn: [privRTable, subnet2]
        });

       this.subnet1Id = subnet1.id;
       this.subnet2Id = subnet2.id;
       this.subnet3Id = subnet2.id;
       this.vpcId = vpc.id;

        this.registerOutputs()
        
    }

}


module.exports.NetworkComponent = NetworkComponent;