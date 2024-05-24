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
    //subnetIds!: pulumi.Output<Array<String>>;
}

export class NetworkComponent extends pulumi.ComponentResource {
    public readonly vpcId: pulumi.Output<string>;
    //public readonly subnetIds!: pulumi.Output<Array<String> >;
    public readonly subnet1Id: pulumi.Output<string>;
    public readonly subnet2Id: pulumi.Output<string>;
    public readonly subnet3Id: pulumi.Output<string>;

    constructor(netname : string, vpcComponentsArgs?:{}, opts?: pulumi.ComponentResourceOptions ){

        super("yte:networkcr:NetworkComponent", netname);
        const prefix = "yte";
        const vpc = new aws.ec2.Vpc("eks-vpc", {
            cidrBlock: "10.0.0.0/24",
            enableDnsHostnames: true,
            tags:{
                Name: prefix + "-eks-vpc",
            },
           
        },{parent: this});

        const cidrBlocks = ["10.0.0.0/25","10.0.0.128/26","10.0.0.192/26"];
        const aZones = ["a", "b", "c"];
        let subnets = [];

        for(let i=0; i<3; i++ ){
            subnets.push(new aws.ec2.Subnet(`eks-subnets-${i}`, {
                vpcId : vpc.id,
                cidrBlock: cidrBlocks[i],
                availabilityZone: `us-east-1${aZones[i]}`,
                tags:{
                    Name: `${prefix}-eks-subnets-${i+1}`,
                },
    
            },
            {
                parent: this,
                dependsOn: [vpc],
    
            }));

        }
        
        
        //create internet gateway
        const gw = new aws.ec2.InternetGateway("eks-igw",{
            vpcId: vpc.id,
            tags:{
                Name: `${prefix}-eks-igw`,
            },
            
        },
        {
            parent: this,
            dependsOn: [vpc],
        });

        const natGwEip = new aws.ec2.Eip("natGwEip", {
            domain: "vpc",
            tags:{
                Name: `${prefix}-eks-natEip`,
            },
        });
        
        const natGw = new aws.ec2.NatGateway("eksNatGw",{
            allocationId: natGwEip.id,
            subnetId: subnets[2].id,
            connectivityType: "public",
            tags: {
                Name: `${prefix}-eks-natGw`,
            }

        },{dependsOn:[subnets[2], natGwEip]});

        const pubRTable = new aws.ec2.RouteTable("eks-pub-rt", {
            vpcId: vpc.id,
            routes:[
                {
                    cidrBlock: "0.0.0.0/0",
                    gatewayId: gw.id,
                }
            ],
            tags:{
                Name: `${prefix}-eks-pubRt`,
            },
        },
        {
            parent: this,
            dependsOn: [vpc, gw],
        });

        const pubRtAssociation = new aws.ec2.RouteTableAssociation("igw-rt", {
            routeTableId: pubRTable.id,
            subnetId: subnets[2].id,
            
        },
        {
            parent: this,
            dependsOn: [pubRTable, subnets[2]]
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
                Name: `${prefix}-eks-privRt`,
            }
        }, {dependsOn:[natGw, vpc]});

        const routeAssociations = [];

        for( let i = 0; i<2; i++ ){
            routeAssociations.push(new aws.ec2.RouteTableAssociation(`privNg-rt${i+1}`,{
                routeTableId: privRTable.id,
                subnetId: subnets[i].id,
                
            },
            {
                parent: this,
                dependsOn: [privRTable, subnets[i]]

            }));

        }
        // const subnetIds = [];
        // for (let i = 0; i<3; i++){
        //     subnetIds.push(subnets[i].id)
        //     this.registerOutputs(subnetIds[i])

        // };
       this.subnet1Id = subnets[0].id;
       this.subnet2Id = subnets[1].id;
       this.subnet3Id = subnets[2].id;
       this.vpcId = vpc.id;

        this.registerOutputs();
        
    }

}
//227

module.exports.NetworkComponent = NetworkComponent;