// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LMS {
    struct TeacherInfo {
        string name;
        string email;
        string password;
        string serviceType;
        string cnic;
        string dob;
        string contactNumber;
        string maritalStatus;
        string homeAddress;
    }

    struct TeacherStatus {
        string currentSchool;
        string dateOfJoining;
        uint256 dateOfJoiningNewSchool;
        string postedAs;
        bool isRequestPending;
        string newSchoolRequest;
    }

    struct Teacher {
        TeacherInfo info;
        TeacherStatus status;
    }

    mapping(address => Teacher) public teachers;
    address public headmaster;

    event SchoolChangeRequest(address teacher, string newSchool);
    event SchoolChangeApproval(address teacher, string newSchool);
    event SchoolChangeRejection(address teacher);

    modifier onlyHeadmaster() {
        require(msg.sender == '0xE2eCa78BFA350bb7d57AC8a1Af40d2A78861350e', "Only headmaster can perform this action");
        _;
    }

    modifier onlyTeacher() {
        require(keccak256(abi.encodePacked(teachers[msg.sender].info.cnic)) != keccak256(abi.encodePacked('')), "Only teacher can perform this action");
        _;
    }

    constructor() {
        headmaster = msg.sender;
    }

    function addTeacher(address teacherAddress, TeacherInfo memory info, TeacherStatus memory status) public onlyHeadmaster {
        teachers[teacherAddress] = Teacher(info, status);
    }

    function updateTeacher(address teacherAddress, TeacherInfo memory info, TeacherStatus memory status) public onlyHeadmaster {
        teachers[teacherAddress] = Teacher(info, status);
    }

    function deleteTeacher(address teacherAddress) public onlyHeadmaster {
        delete teachers[teacherAddress];
    }

    function requestSchoolChange(string memory newSchool) public onlyTeacher {
        teachers[msg.sender].status.isRequestPending = true;
        teachers[msg.sender].status.newSchoolRequest = newSchool;
        emit SchoolChangeRequest(msg.sender, newSchool);
    }

    function approveSchoolChange(address teacherAddress) public onlyHeadmaster {
        require(teachers[teacherAddress].status.isRequestPending, "No pending request");
        teachers[teacherAddress].status.currentSchool = teachers[teacherAddress].status.newSchoolRequest;
        teachers[teacherAddress].status.dateOfJoiningNewSchool = block.timestamp;
        teachers[teacherAddress].status.isRequestPending = false;
        emit SchoolChangeApproval(teacherAddress, teachers[teacherAddress].status.currentSchool);
    }

    function rejectSchoolChange(address teacherAddress) public onlyHeadmaster {
        require(teachers[teacherAddress].status.isRequestPending, "No pending request");
        teachers[teacherAddress].status.isRequestPending = false;
        emit SchoolChangeRejection(teacherAddress);
    }

    function getTeacher(address teacherAddress) public view returns (TeacherInfo memory, TeacherStatus memory) {
        return (teachers[teacherAddress].info, teachers[teacherAddress].status);
    }
}
