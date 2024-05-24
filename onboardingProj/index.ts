import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import { NetworkComponent } from "./cr_network";
const cr_network = require("./cr_network");


// *** IAM Role for EKS ******* //

const assumeRole = aws.iam.getPolicyDocument({
    statements:[{
        effect:"Allow",
        principals:[{
            type: "Service",
            identifiers: ["eks.amazonaws.com"],
        }],
        actions:["sts:AssumeRole"]
    }],
});

const eksRole = new aws.iam.Role("eksRole", {
    name: "yte-demo-eksRole",
    assumeRolePolicy: assumeRole.then(assumeRole => assumeRole.json),
});

const existingEKSClusterPolicy = new aws.iam.RolePolicyAttachment("demoEKSClusterRole", {
    policyArn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    role: eksRole.name,
    
}, {dependsOn:[eksRole]});

const existingEKSVPCPolicy = new aws.iam.RolePolicyAttachment("demoEKSVPCRole", {
    policyArn: "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController",
    role: eksRole.name,
    
}, {dependsOn:[eksRole]});



// **** NETWORK COMPONENT ******//

const vpcComponents = new cr_network.NetworkComponent("eks-network", {
});


/********* EKS CLUSTER *******/
const eksCluster = new eks.Cluster("eks", {
    vpcId: vpcComponents.vpcId,
    privateSubnetIds: [
         vpcComponents.subnet1Id,
         vpcComponents.subnet2Id,
        ],
    publicSubnetIds: [
            vpcComponents.subnet3Id,
         ],

    serviceRole: eksRole,
    minSize: 1,
    maxSize: 2,
    tags: {
        Name: "yte-eks-cluster",
    },
    
},{dependsOn:[vpcComponents]});



export const kConfig = eksCluster.kubeconfig;
export const eksClusterProvder = eksCluster.provider;
export const subnetIDS = [vpcComponents.subnet1Id, vpcComponents.subnet2Id, vpcComponents.subnet3Id];