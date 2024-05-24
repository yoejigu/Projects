import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import { NetworkComponent } from "./cr_network";
//const cr_network = require("./cr_network"); <--- Is there a preference here


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

const policyArns = ["arn:aws:iam::aws:policy/AmazonEKSClusterPolicy", "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"]
for(let i=0; i<2; i++){
    new aws.iam.RolePolicyAttachment(`existingEksRole-${i}`, {
        policyArn: policyArns[i],
        role: eksRole.name
    },{dependsOn:[eksRole]})
};

// **** NETWORK COMPONENT ******//

const vpcComponents = new NetworkComponent("eks-network", {
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
//export const subnetIds = vpcComponents.subnets[0];
export const subnetIDS = [vpcComponents.subnet1Id, vpcComponents.subnet2Id, vpcComponents.subnet3Id];